import sys
import os
sys.path.insert(0, os.getcwd())
from app.config import Config
from app.database import init_db, db

class DummyApp:
    pass

config = Config()
app = DummyApp()
app.config = {k: v for k, v in Config.__dict__.items() if not k.startswith('__') and not callable(v)}
# Ensure environment-loaded values are included
for key in ('MONGODB_URI', 'MONGODB_DB_NAME'):
    app.config[key] = getattr(config, key)
init_db(app)

print('collections=', db.list_collection_names())
print('students=', db.students.count_documents({}))
print('gfg username count=', db.students.count_documents({'geeksforgeeks_username': {'$exists': True}}))
print('platform_usernames.gfg count=', db.students.count_documents({'platform_usernames.geeksforgeeks': {'$exists': True}}))
print('platform_profiles.gfg count=', db.students.count_documents({'platform_profiles.geeksforgeeks': {'$exists': True}}))

if 'geeksforgeeks_profiles' in db.list_collection_names():
    print('dropping geeksforgeeks_profiles')
    db.geeksforgeeks_profiles.drop()

res1 = db.students.update_many({'geeksforgeeks_username': {'$exists': True}}, {'$unset': {'geeksforgeeks_username': ''}})
res2 = db.students.update_many({'platform_usernames.geeksforgeeks': {'$exists': True}}, {'$unset': {'platform_usernames.geeksforgeeks': ''}})
res3 = db.students.update_many({'platform_profiles.geeksforgeeks': {'$exists': True}}, {'$unset': {'platform_profiles.geeksforgeeks': ''}})
print('unset gfg username=', res1.modified_count)
print('unset platform_usernames=', res2.modified_count)
print('unset platform_profiles=', res3.modified_count)
