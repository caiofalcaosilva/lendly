import os
from unittest.mock import MagicMock, patch

from PIL import Image

from app.config import settings
from app.services import storage


def _image():
    return Image.new("RGB", (4, 4), color="blue")


def _configure_r2(monkeypatch):
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "acct-123")
    monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "key-123")
    monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "secret-123")
    monkeypatch.setattr(settings, "R2_BUCKET_NAME", "lendly-test")
    monkeypatch.setattr(settings, "R2_PUBLIC_URL", "https://cdn.example.com")


# --- Local disk (default, no R2 configured) ---------------------------------


def test_save_public_image_writes_to_local_disk(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    url = storage.save_public_image(_image(), "avatars/u1/test.jpg")
    assert url == f"{settings.API_PUBLIC_URL}/uploads/avatars/u1/test.jpg"
    assert os.path.exists(tmp_path / "uploads" / "avatars" / "u1" / "test.jpg")


def test_save_private_image_writes_to_local_disk(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    reference = storage.save_private_image(_image(), "u1/selfie_test.jpg")
    assert reference == os.path.join("verification_uploads", "u1", "selfie_test.jpg")
    assert os.path.exists(tmp_path / "verification_uploads" / "u1" / "selfie_test.jpg")


def test_private_image_url_is_none_without_r2():
    assert storage.private_image_url("u1/selfie_test.jpg") is None


# --- R2 (mocked boto3 client) -------------------------------------------------


def test_save_public_image_uploads_to_r2(monkeypatch):
    _configure_r2(monkeypatch)
    mock_client = MagicMock()
    with patch("app.services.storage._r2_client", return_value=mock_client):
        url = storage.save_public_image(_image(), "items/i1/test.jpg")

    assert url == "https://cdn.example.com/items/i1/test.jpg"
    mock_client.put_object.assert_called_once()
    kwargs = mock_client.put_object.call_args.kwargs
    assert kwargs["Bucket"] == "lendly-test"
    assert kwargs["Key"] == "items/i1/test.jpg"
    assert kwargs["ContentType"] == "image/jpeg"


def test_save_private_image_uploads_to_r2_and_returns_key(monkeypatch):
    _configure_r2(monkeypatch)
    mock_client = MagicMock()
    with patch("app.services.storage._r2_client", return_value=mock_client):
        reference = storage.save_private_image(_image(), "u1/document_test.jpg")

    assert reference == "u1/document_test.jpg"
    mock_client.put_object.assert_called_once()


def test_private_image_url_returns_presigned_url_from_r2(monkeypatch):
    _configure_r2(monkeypatch)
    mock_client = MagicMock()
    mock_client.generate_presigned_url.return_value = "https://signed.example.com/x"
    with patch("app.services.storage._r2_client", return_value=mock_client):
        url = storage.private_image_url("u1/document_test.jpg")

    assert url == "https://signed.example.com/x"
    mock_client.generate_presigned_url.assert_called_once_with(
        "get_object",
        Params={"Bucket": "lendly-test", "Key": "u1/document_test.jpg"},
        ExpiresIn=300,
    )
