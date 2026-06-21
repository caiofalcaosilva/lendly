from pydantic import BaseModel


class TwoFactorComplete(BaseModel):
    temp_token: str
    code: str
    trust_device: bool = True


class TotpSetupResponse(BaseModel):
    secret: str
    uri: str


class TotpConfirm(BaseModel):
    code: str


class TotpDisable(BaseModel):
    code: str
