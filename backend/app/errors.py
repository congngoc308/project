from typing import Any


class DomainError(Exception):
    status_code = 400

    def __init__(self, message: str, data: Any = None):
        super().__init__(message)
        self.message = message
        self.data = data


class Invalid(DomainError):
    status_code = 400


class Forbidden(DomainError):
    status_code = 403


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    status_code = 409
