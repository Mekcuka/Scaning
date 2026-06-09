"""Assistant chat errors."""


class ChatError(Exception):
    def __init__(self, message: str, code: str = "chat_error") -> None:
        self.message = message
        self.code = code
        super().__init__(message)
