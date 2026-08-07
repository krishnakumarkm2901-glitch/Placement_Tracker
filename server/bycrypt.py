import bcrypt

hashed = b"$2b$12$54IS13mLiVgf0zMQAT/bHuEz39LLZNjGaWdlz6KLFyGfXr9DfVe2K"

password = b"Krishnakm2901@"

if bcrypt.checkpw(password, hashed):
    print("Match!")
else:
    print("Not a match.")