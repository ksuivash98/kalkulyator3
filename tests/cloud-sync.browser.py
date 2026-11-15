"""Contract tests against a fake Supabase HTTP endpoint, not a live Supabase project.
Run from the repo with the dev server on port 8000: python3 tests/cloud-sync.browser.py
"""
import json
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

BASE = 'https://test-project.supabase.co'
rows = {}
users = {'one@example.test': '11111111-1111-4111-8111-111111111111', 'two@example.test': '22222222-2222-4222-8222-222222222222'}


def endpoint(route):
    request = route.request
    path = urlparse(request.url).path
    body = request.post_data_json if request.post_data else {}
    token = request.headers.get('authorization', '').removeprefix('Bearer ')
    status, response = 200, {}
    if path == '/auth/v1/signup':
        response = {'user': {'id': users['one@example.test']}}
    elif path == '/auth/v1/token':
        email = body.get('email', 'one@example.test')
        uid = users[email]
        response = {'access_token': uid, 'refresh_token': 'test-refresh', 'expires_in': 3600, 'user': {'id': uid, 'email': email}}
    elif path == '/auth/v1/logout':
        response = {}
    elif token not in users.values():
        status, response = 401, {}
    elif path == '/rest/v1/salary_snapshots':
        assert parse_qs(urlparse(request.url).query)['user_id'] == ['eq.' + token]
        response = [rows[token]] if token in rows else []
    elif path == '/rest/v1/rpc/save_salary_snapshot':
        revision = rows.get(token, {}).get('revision', 0)
        if body['expected_revision'] != revision:
            status, response = 409, {'code': '40001'}
        else:
            rows[token] = {'payload': body['payload'], 'revision': revision + 1}
            response = {'revision': revision + 1}
    else:
        raise AssertionError(path)
    route.fulfill(status=status, content_type='application/json', body=json.dumps(response), headers={'Access-Control-Allow-Origin': '*'})


def open_device(browser):
    context = browser.new_context()
    context.route('**/cloud-config.js*', lambda route: route.fulfill(content_type='application/javascript', body=f'window.SALARY_CLOUD_CONFIG={{url:"{BASE}",publishableKey:"sb_publishable_TEST"}};'))
    context.route(BASE + '/**', endpoint)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto('http://127.0.0.1:8000/')
    return context, page


def login(page, email='one@example.test'):
    page.locator('#cloud-email').fill(email)
    page.locator('#cloud-password').fill('example-password')
    page.locator('#cloud-auth-form button[value="login"]').click()
    expect(page.locator('#cloud-account')).to_be_visible()
    page.wait_for_function('!window.__salaryCloud.busy && !window.__salaryCloud.authPending')


def synced(page):
    page.evaluate('() => window.__salaryCloud.sync()')
    expect(page.locator('#cloud-status')).to_contain_text('Синхронизировано')


errors = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    a, first = open_device(browser)
    first.locator('#cloud-email').fill('one@example.test')
    first.locator('#cloud-password').fill('example-password')
    first.locator('#cloud-auth-form button[value="register"]').click()
    expect(first.locator('#cloud-status')).to_contain_text('подтвердите адрес')
    # Guest data must stay separate and only migrate through the explicit action.
    first.locator('#work-hours').fill('183')
    first.wait_for_timeout(500)
    login(first)
    assert first.locator('#work-hours').input_value() == ''
    first.locator('#cloud-import-local').click()
    first.wait_for_function('!window.__salaryCloud.busy')
    synced(first)
    assert len(rows[users['one@example.test']]['payload']['employees']) == 2
    b, second = open_device(browser)
    login(second)
    assert second.locator('#employee-list li').count() == 2
    second.locator('#employee-list li').nth(1).click()
    assert second.locator('#work-hours').input_value() == '183'
    first.locator('#employee-list li').nth(1).click()
    # Simultaneous offline changes produce a conflict, never a silent overwrite.
    b.set_offline(True)
    second.locator('#work-hours').fill('160')
    second.wait_for_timeout(500)
    first.locator('#work-hours').fill('170')
    first.wait_for_timeout(500)
    synced(first)
    b.set_offline(False)
    second.evaluate('() => window.__salaryCloud.sync()')
    expect(second.locator('#cloud-conflict')).to_be_visible()
    assert second.locator('#work-hours').input_value() == '160'
    second.locator('#cloud-use-server').click()
    expect(second.locator('#cloud-conflict')).to_be_hidden()
    assert second.locator('#work-hours').input_value() == '170'
    # Refresh an expiring session and exercise the other conflict resolution.
    second.evaluate('window.__salaryCloud.session.expires_at = 0')
    synced(second)
    b.set_offline(True)
    second.locator('#work-hours').fill('165')
    second.wait_for_timeout(500)
    second.wait_for_function('!window.__salaryCloud.busy')
    rows[users['one@example.test']]['revision'] += 1
    b.set_offline(False)
    second.evaluate('() => window.__salaryCloud.sync()')
    expect(second.locator('#cloud-conflict')).to_be_visible()
    second.locator('#cloud-use-local').click()
    expect(second.locator('#cloud-conflict')).to_be_hidden()
    second.wait_for_function('!window.__salaryCloud.busy')
    assert rows[users['one@example.test']]['payload']['employees'][1]['periods'][second.evaluate('window.__salaryApp.activePeriod.key')]['workHours'] == 165
    # Reload restores session and account data; logout restores guest data.
    second.reload()
    expect(second.locator('#cloud-account')).to_be_visible()
    assert second.locator('#employee-list li').count() == 2
    first.locator('#cloud-logout').click()
    expect(first.locator('#cloud-auth-form')).to_be_visible()
    assert first.locator('#work-hours').input_value() == '183'
    login(first, 'two@example.test')
    assert first.locator('#employee-list li').count() == 1
    assert first.locator('#work-hours').input_value() == ''
    first.locator('#work-hours').fill('80')
    first.wait_for_timeout(500)
    synced(first)
    assert next(iter(rows[users['one@example.test']]['payload']['employees'][1]['periods'].values()))['workHours'] == 165
    assert next(iter(rows[users['two@example.test']]['payload']['employees'][0]['periods'].values()))['workHours'] == 80
    assert not first.evaluate("new SalaryCloudApi({url:'https://test-project.supabase.co',publishableKey:'sb_secret_EXAMPLE'}).configured")
    first.set_viewport_size({'width': 390, 'height': 844})
    assert first.locator('#cloud-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
    assert not errors, errors
    browser.close()
print('Mock Supabase contract: registration, two devices, guest migration, conflict, offline edits, session restore and account isolation passed')
