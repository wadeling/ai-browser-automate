"""
元素定位器 - 使用多种策略定位页面元素
"""
import time
from typing import Optional, List, Tuple
from playwright.sync_api import Page, Locator
from loguru import logger

from .models import ElementInfo, LearningRecord

class ElementLocator:
    """元素定位器"""
    
    def __init__(self, page: Page, selector_priority: List[str] = None):
        self.page = page
        self.selector_priority = selector_priority or ["id", "css", "xpath", "text"]
    
    def locate_element(self, record: LearningRecord, timeout: int = 5000) -> Optional[Locator]:
        """定位元素，使用多种策略"""
        element = record.element
        
        # 按优先级尝试不同的定位策略
        for strategy in self.selector_priority:
            locator = self._try_strategy(strategy, element, record)
            if locator and self._is_element_visible(locator, timeout):
                logger.debug(f"使用 {strategy} 策略成功定位元素: {element.tagName}")
                return locator
        
        logger.warning(f"无法定位元素: {record.description}")
        return None
    
    def _try_strategy(self, strategy: str, element: ElementInfo, record: LearningRecord) -> Optional[Locator]:
        """尝试特定的定位策略"""
        try:
            if strategy == "id" and element.id:
                return self.page.locator(f"#{element.id}")
            
            elif strategy == "css" and element.selector:
                # 清理和优化CSS选择器
                selector = self._clean_css_selector(element.selector)
                return self.page.locator(selector)
            
            elif strategy == "xpath" and element.xpath:
                return self.page.locator(f"xpath={element.xpath}")
            
            elif strategy == "text" and element.textContent:
                # 使用文本内容定位
                text = element.textContent.strip()
                if text:
                    return self.page.locator(f"text={text}")
            
            elif strategy == "placeholder" and element.placeholder:
                return self.page.locator(f"[placeholder='{element.placeholder}']")
            
            elif strategy == "tag":
                # 使用标签名和类名组合
                if element.className:
                    classes = element.className.split()
                    class_selector = ".".join(classes)
                    return self.page.locator(f"{element.tagName.lower()}.{class_selector}")
                else:
                    return self.page.locator(element.tagName.lower())
        
        except Exception as e:
            logger.debug(f"策略 {strategy} 失败: {e}")
            return None
    
    def _clean_css_selector(self, selector: str) -> str:
        """清理和优化CSS选择器"""
        # 移除多余的空格
        selector = " ".join(selector.split())
        
        # 确保选择器以标签名开头（如果没有的话）
        if not selector[0].isalpha() and not selector.startswith(('.', '#', '[')):
            # 这里可以根据需要添加默认标签名
            pass
        
        return selector
    
    def _is_element_visible(self, locator: Locator, timeout: int = 5000) -> bool:
        """检查元素是否可见"""
        try:
            locator.wait_for(state="visible", timeout=timeout)
            return True
        except Exception:
            return False
    
    def find_alternative_selectors(self, record: LearningRecord) -> List[Tuple[str, str]]:
        """查找替代选择器"""
        element = record.element
        alternatives = []
        
        # 基于ID的选择器
        if element.id:
            alternatives.append(("id", f"#{element.id}"))
        
        # 基于类名的选择器
        if element.className:
            classes = element.className.split()
            for class_name in classes:
                if class_name.strip():
                    alternatives.append(("class", f".{class_name}"))
        
        # 基于标签名和类名的组合
        if element.className:
            class_selector = ".".join(element.className.split())
            alternatives.append(("tag+class", f"{element.tagName.lower()}.{class_selector}"))
        
        # 基于文本内容的选择器
        if element.textContent and element.textContent.strip():
            text = element.textContent.strip()
            alternatives.append(("text", f"text={text}"))
        
        # 基于占位符的选择器
        if element.placeholder:
            alternatives.append(("placeholder", f"[placeholder='{element.placeholder}']"))
        
        return alternatives
    
    def wait_for_element(self, record: LearningRecord, timeout: int = 10000) -> Optional[Locator]:
        """等待元素出现"""
        start_time = time.time()
        
        while time.time() - start_time < timeout / 1000:
            locator = self.locate_element(record, timeout=1000)
            if locator:
                return locator
            
            time.sleep(0.5)
        
        return None
    
    def scroll_to_element(self, locator: Locator) -> bool:
        """滚动到元素位置"""
        try:
            locator.scroll_into_view_if_needed()
            return True
        except Exception as e:
            logger.warning(f"滚动到元素失败: {e}")
            return False
    
    def get_element_info(self, locator: Locator) -> dict:
        """获取元素的详细信息"""
        try:
            element_info = {
                'tag_name': locator.evaluate('el => el.tagName'),
                'id': locator.get_attribute('id'),
                'class': locator.get_attribute('class'),
                'text': locator.text_content(),
                'is_visible': locator.is_visible(),
                'is_enabled': locator.is_enabled(),
                'bounding_box': locator.bounding_box()
            }
            return element_info
        except Exception as e:
            logger.warning(f"获取元素信息失败: {e}")
            return {}
    
    def validate_element_state(self, locator: Locator, record: LearningRecord) -> bool:
        """验证元素状态是否适合操作"""
        try:
            # 检查元素是否可见
            if not locator.is_visible():
                logger.warning(f"元素不可见: {record.description}")
                return False
            
            # 检查元素是否启用
            if not locator.is_enabled():
                logger.warning(f"元素未启用: {record.description}")
                return False
            
            # 对于输入元素，检查是否可编辑
            if record.type in ['input', 'change']:
                tag_name = locator.evaluate('el => el.tagName').lower()
                if tag_name in ['input', 'textarea', 'select']:
                    readonly = locator.get_attribute('readonly')
                    disabled = locator.get_attribute('disabled')
                    if readonly or disabled:
                        logger.warning(f"输入元素不可编辑: {record.description}")
                        return False
            
            return True
        
        except Exception as e:
            logger.warning(f"验证元素状态失败: {e}")
            return False 