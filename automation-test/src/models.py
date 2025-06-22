"""
数据模型定义
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class ElementInfo(BaseModel):
    """页面元素信息"""
    tagName: str
    id: Optional[str] = None
    className: Optional[str] = None
    textContent: Optional[str] = None
    placeholder: Optional[str] = None
    type: Optional[str] = None
    action: Optional[str] = None
    xpath: str
    selector: str

class Position(BaseModel):
    """鼠标位置信息"""
    x: int
    y: int

class LearningRecord(BaseModel):
    """学习记录"""
    type: str  # click, input, change, submit
    description: str
    url: str
    element: ElementInfo
    timestamp: datetime
    position: Optional[Position] = None
    value: Optional[str] = None

class ReplayResult(BaseModel):
    """重放结果"""
    record: LearningRecord
    success: bool
    error_message: Optional[str] = None
    execution_time: float
    retry_count: int = 0
    selector_used: Optional[str] = None

class ReplaySession(BaseModel):
    """重放会话"""
    session_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    total_records: int
    successful_records: int
    failed_records: int
    results: List[ReplayResult] = []
    summary: Dict[str, Any] = {}

class TestConfig(BaseModel):
    """测试配置"""
    browser_type: str = "chromium"
    headless: bool = False
    slow_mo: int = 1000
    timeout: int = 30000
    replay_delay: float = 1.0
    retry_count: int = 3
    wait_for_navigation: bool = True
    selector_priority: List[str] = ["id", "css", "xpath", "text"]
    
    # AI配置
    openai_api_key: Optional[str] = None
    openai_base_url: Optional[str] = None
    openai_model: str = "gpt-3.5-turbo"
    max_tokens: int = 1000 