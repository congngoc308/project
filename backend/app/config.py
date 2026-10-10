from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://qlb:qlb@localhost:5450/qlb"
    secret_key: str = "dev-secret-chi-dung-khi-chay-tren-may-ca-nhan"
    demo_mode: bool = True
    upload_dir: str = "./uploads"
    cors_origins: str = "http://localhost:5190"
    session_hours: int = 12
    run_jobs: bool = True


settings = Settings()
