"""
自动化测试配置文件
"""
import os
from pathlib import Path
from typing import Optional
from pydantic import BaseSettings

class Settings(BaseSettings):
    """应用配置类"""
    
    # 项目根目录
    BASE_DIR: Path = Path(__file__).parent.parent
    
    # 数据目录
    DATA_DIR: Path = BASE_DIR / "data"
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Optional[str] = None
    
    # Playwright配置
    BROWSER_TYPE: str = "chromium"  # chromium, firefox, webkit
    HEADLESS: bool = False
    SLOW_MO: int = 1000  # 操作间隔时间(毫秒)
    TIMEOUT: int = 30000  # 超时时间(毫秒)
    
    # 重放配置
    REPLAY_DELAY: float = 1.0  # 操作间延迟(秒)
    RETRY_COUNT: int = 3  # 重试次数
    WAIT_FOR_NAVIGATION: bool = True  # 是否等待页面导航
    
    # AI配置
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None  # OpenAI兼容接口的base URL
    OPENAI_MODEL: str = "gpt-3.5-turbo"  # 默认模型
    MAX_TOKENS: int = 1000
    
    # 选择器策略
    SELECTOR_PRIORITY: list = ["id", "css", "xpath", "text"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# 全局配置实例
settings = Settings()

# 确保数据目录存在
settings.DATA_DIR.mkdir(exist_ok=True) 