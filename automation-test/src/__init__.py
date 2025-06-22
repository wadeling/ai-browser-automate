"""
AI浏览器自动化测试工具包
"""

__version__ = "1.0.0"
__author__ = "AI Browser Automation Team"

from .models import (
    ElementInfo,
    Position,
    LearningRecord,
    ReplayResult,
    ReplaySession,
    TestConfig
)

from .data_loader import LearningDataLoader
from .element_locator import ElementLocator
from .action_executor import ActionExecutor
from .ai_assistant import AIAssistant
from .replay_engine import ReplayEngine

__all__ = [
    'ElementInfo',
    'Position', 
    'LearningRecord',
    'ReplayResult',
    'ReplaySession',
    'TestConfig',
    'LearningDataLoader',
    'ElementLocator',
    'ActionExecutor',
    'AIAssistant',
    'ReplayEngine'
] 