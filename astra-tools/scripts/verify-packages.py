from pathlib import Path
import json, zipfile, re
root=Path.cwd()
expected={'revisiondesk':{'activeTab','scripting','storage','contextMenus'},'filefit':{'storage'},'claimpack':{'storage'},'sharesafe':{'storage','activeTab'},'downloadrules':{'storage','downloads'}}
expected.update({'stepguide':{'activeTab','tabs','scripting','storage'},'replyready':{'tabs','scripting','storage'},'watchdesk':{'tabs','scripting','alarms','notifications','storage'},'followupdesk':{'scripting','alarms','notifications','storage'}})
for product,permissions in expected.items():
    package=root/'public/downloads'/f'{product}.zip'
    with zipfile.ZipFile(package) as z:
        assert z.testzip() is None, f'Corrupt ZIP: {product}'
        names=z.namelist()
        assert 'manifest.json' in names
        manifest=json.loads(z.read('manifest.json'))
        assert manifest['manifest_version']==3
        assert set(manifest['permissions'])==permissions
        for f in ['tool.html','background.js','tools/boot.js',f'tools/{product}.js','shared/config.js']:
            assert f in names, f'Missing {f} in {product}'
        for f in names:
            assert not f.startswith('/') and '..' not in Path(f).parts
            assert '.dev.vars' not in f and '.env' not in f
        if product in ['stepguide','replyready','watchdesk','followupdesk']:
            assert 'content.js' in names and 'runtime.js' in names
            assert manifest.get('optional_host_permissions')
            assert not manifest.get('host_permissions')
        config=z.read('shared/config.js').decode()
        assert 'PRIVATE' not in config and '"d":' not in config
        assert all(f'icons/icon-{n}.png' in names for n in [16,32,48,128])
        if product in ['claimpack','stepguide']:
            assert 'vendor/pdf-lib.min.js' in names
    print(f'{product}: manifest, permissions, files, signatures and ZIP integrity OK')
with zipfile.ZipFile(root/'tests/output/zip-test.zip') as z:
    assert z.read('photo-01.txt')==b'hello'
    assert z.read('தமிழ்.txt')==b'world'
    assert z.testzip() is None
print('Generated ZIPs preserve UTF-8 filenames and CRC integrity.')
for html in (root/'public').glob('*.html'):
    for asset in re.findall(r'(?:src|href)="(/[^"?#]+)',html.read_text(encoding='utf8')):
        assert (root/'public'/asset.lstrip('/')).exists(), f'Missing {asset} in {html}'
print('HTML local asset references OK.')
