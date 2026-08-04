from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared instance: imported by main.py (to register the middleware/exception
# handler) and by individual routers (to decorate specific endpoints). A
# separate module avoids a circular import between the two.
limiter = Limiter(key_func=get_remote_address)
