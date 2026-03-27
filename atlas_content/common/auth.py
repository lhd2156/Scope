from dataclasses import dataclass
@dataclass
class TokenUser:
    id: str
    email: str | None = None
    name: str | None = None
    roles: list[str] | None = None
    is_authenticated: bool = True
    @property
    def is_admin(self) -> bool:
        return 'admin' in (self.roles or [])
    @property
    def is_anonymous(self) -> bool:
        return False
