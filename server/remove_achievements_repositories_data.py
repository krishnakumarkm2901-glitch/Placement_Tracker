import os
import sys
sys.path.insert(0, os.getcwd())
from app.config import Config
from app.database import init_db, db

class DummyApp:
    pass

config = Config()
app = DummyApp()
app.config = {k: getattr(config, k) for k in dir(config) if k.isupper()}
init_db(app)

print('collections=', db.list_collection_names())
print('achievements count=', db.achievements.count_documents({}))
print('repositories count=', db.repositories.count_documents({}))
print('students with achievements field=', db.students.count_documents({'achievements': {'$exists': True}}))
print('students with repos field=', db.students.count_documents({'repositories': {'$exists': True}}))

if 'achievements' in db.list_collection_names():
    print('dropping achievements collection')
    db.achievements.drop()
if 'repositories' in db.list_collection_names():
    print('dropping repositories collection')
    db.repositories.drop()

res1 = db.students.update_many({'achievements': {'$exists': True}}, {'$unset': {'achievements': ''}})
res2 = db.students.update_many({'repositories': {'$exists': True}}, {'$unset': {'repositories': ''}})
print('unset achievements field=', res1.modified_count)
print('unset repositories field=', res2.modified_count)
