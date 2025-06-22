"""
操作执行器 - 使用Playwright执行各种操作
"""
import time
from typing import Optional, Dict, Any
from playwright.sync_api import Page, Locator
from loguru import logger

from .models import LearningRecord, ReplayResult
from .element_locator import ElementLocator

class ActionExecutor:
    """操作执行器"""
    
    def __init__(self, page: Page, config: Dict[str, Any] = None):
        self.page = page
        self.config = config or {}
        self.locator = ElementLocator(page, self.config.get('selector_priority'))
        
        # 配置参数
        self.replay_delay = self.config.get('replay_delay', 1.0)
        self.retry_count = self.config.get('retry_count', 3)
        self.wait_for_navigation = self.config.get('wait_for_navigation', True)
    
    def execute_action(self, record: LearningRecord) -> ReplayResult:
        """执行单个操作"""
        start_time = time.time()
        retry_count = 0
        last_error = None
        
        for attempt in range(self.retry_count + 1):
            try:
                logger.info(f"执行操作 {attempt + 1}/{self.retry_count + 1}: {record.description}")
                
                # 定位元素
                locator = self.locator.locate_element(record)
                if not locator:
                    raise Exception("无法定位元素")
                
                # 验证元素状态
                if not self.locator.validate_element_state(locator, record):
                    raise Exception("元素状态不适合操作")
                
                # 滚动到元素位置
                self.locator.scroll_to_element(locator)
                
                # 执行具体操作
                selector_used = self._execute_specific_action(record, locator)
                
                # 等待操作完成
                if self.replay_delay > 0:
                    time.sleep(self.replay_delay)
                
                # 计算执行时间
                execution_time = time.time() - start_time
                
                return ReplayResult(
                    record=record,
                    success=True,
                    execution_time=execution_time,
                    retry_count=retry_count,
                    selector_used=selector_used
                )
                
            except Exception as e:
                last_error = str(e)
                retry_count = attempt
                logger.warning(f"操作失败 (尝试 {attempt + 1}): {e}")
                
                if attempt < self.retry_count:
                    time.sleep(1)  # 重试前等待
                    continue
        
        # 所有重试都失败了
        execution_time = time.time() - start_time
        return ReplayResult(
            record=record,
            success=False,
            error_message=last_error,
            execution_time=execution_time,
            retry_count=retry_count
        )
    
    def _execute_specific_action(self, record: LearningRecord, locator: Locator) -> str:
        """执行具体的操作"""
        action_type = record.type
        selector_used = "unknown"
        
        try:
            if action_type == "click":
                selector_used = self._execute_click(record, locator)
            
            elif action_type == "input":
                selector_used = self._execute_input(record, locator)
            
            elif action_type == "change":
                selector_used = self._execute_change(record, locator)
            
            elif action_type == "submit":
                selector_used = self._execute_submit(record, locator)
            
            else:
                raise Exception(f"不支持的操作类型: {action_type}")
            
            return selector_used
            
        except Exception as e:
            logger.error(f"执行 {action_type} 操作失败: {e}")
            raise
    
    def _execute_click(self, record: LearningRecord, locator: Locator) -> str:
        """执行点击操作"""
        # 确定使用的选择器
        selector_used = self._determine_selector_used(record)
        
        # 执行点击
        if record.position:
            # 使用坐标点击
            locator.click(position={'x': record.position.x, 'y': record.position.y})
        else:
            # 普通点击
            locator.click()
        
        logger.debug(f"点击操作成功: {record.description}")
        return selector_used
    
    def _execute_input(self, record: LearningRecord, locator: Locator) -> str:
        """执行输入操作"""
        selector_used = self._determine_selector_used(record)
        
        # 清空现有内容
        locator.clear()
        
        # 输入新内容
        if record.value:
            locator.fill(record.value)
        else:
            # 如果没有value，尝试使用textContent作为占位符
            if record.element.textContent:
                locator.fill(record.element.textContent)
        
        logger.debug(f"输入操作成功: {record.description}")
        return selector_used
    
    def _execute_change(self, record: LearningRecord, locator: Locator) -> str:
        """执行选择操作"""
        selector_used = self._determine_selector_used(record)
        
        # 获取元素类型
        tag_name = locator.evaluate('el => el.tagName').lower()
        
        if tag_name == 'select':
            # 下拉选择框
            if record.value:
                locator.select_option(value=record.value)
            else:
                # 如果没有value，选择第一个选项
                locator.select_option(index=0)
        
        elif tag_name == 'input':
            # 输入框类型
            input_type = locator.get_attribute('type')
            if input_type in ['checkbox', 'radio']:
                # 复选框或单选按钮
                current_state = locator.is_checked()
                if not current_state:
                    locator.check()
            else:
                # 普通输入框
                self._execute_input(record, locator)
        
        logger.debug(f"选择操作成功: {record.description}")
        return selector_used
    
    def _execute_submit(self, record: LearningRecord, locator: Locator) -> str:
        """执行表单提交操作"""
        selector_used = self._determine_selector_used(record)
        
        # 提交表单
        locator.press("Enter")
        
        # 等待页面导航（如果配置了）
        if self.wait_for_navigation:
            try:
                self.page.wait_for_load_state("networkidle", timeout=10000)
            except Exception as e:
                logger.warning(f"等待页面导航超时: {e}")
        
        logger.debug(f"表单提交成功: {record.description}")
        return selector_used
    
    def _determine_selector_used(self, record: LearningRecord) -> str:
        """确定使用的选择器类型"""
        element = record.element
        
        if element.id:
            return "id"
        elif element.selector:
            return "css"
        elif element.xpath:
            return "xpath"
        elif element.textContent:
            return "text"
        else:
            return "unknown"
    
    def wait_for_page_load(self, timeout: int = 10000):
        """等待页面加载完成"""
        try:
            self.page.wait_for_load_state("networkidle", timeout=timeout)
        except Exception as e:
            logger.warning(f"等待页面加载超时: {e}")
    
    def take_screenshot(self, path: str = None) -> str:
        """截图"""
        if not path:
            timestamp = int(time.time())
            path = f"screenshot_{timestamp}.png"
        
        self.page.screenshot(path=path)
        logger.info(f"截图已保存: {path}")
        return path
    
    def get_page_info(self) -> Dict[str, Any]:
        """获取页面信息"""
        try:
            return {
                'url': self.page.url,
                'title': self.page.title(),
                'viewport_size': self.page.viewport_size,
                'content': self.page.content()[:1000]  # 前1000个字符
            }
        except Exception as e:
            logger.warning(f"获取页面信息失败: {e}")
            return {} 