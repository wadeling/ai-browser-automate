"""
AI助手 - 使用LangChain处理复杂决策和错误恢复
"""
import json
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.prompts import ChatPromptTemplate
from loguru import logger

from .models import LearningRecord, ReplayResult

class AIAssistant:
    """AI助手，用于处理复杂的自动化决策"""
    
    def __init__(self, api_key: str = None, model: str = "gpt-3.5-turbo", 
                 base_url: str = None, max_tokens: int = 1000):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.max_tokens = max_tokens
        self.llm = None
        
        if api_key:
            try:
                # 构建ChatOpenAI配置
                llm_config = {
                    'openai_api_key': api_key,
                    'model': model,
                    'temperature': 0.1,
                    'max_tokens': max_tokens
                }
                
                # 如果提供了base_url，使用自定义端点
                if base_url:
                    llm_config['openai_api_base'] = base_url
                    logger.info(f"使用自定义API端点: {base_url}")
                
                self.llm = ChatOpenAI(**llm_config)
                logger.info(f"AI助手初始化成功，使用模型: {model}")
                
            except Exception as e:
                logger.warning(f"AI助手初始化失败: {e}")
    
    def is_available(self) -> bool:
        """检查AI助手是否可用"""
        return self.llm is not None
    
    def analyze_failure(self, record: LearningRecord, error_message: str, 
                       page_info: Dict[str, Any]) -> Dict[str, Any]:
        """分析操作失败的原因并提供建议"""
        if not self.is_available():
            return self._default_failure_analysis(record, error_message)
        
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", """你是一个网页自动化测试专家。分析操作失败的原因并提供解决方案。

分析要点：
1. 元素定位问题（选择器失效、页面结构变化）
2. 元素状态问题（不可见、禁用、被遮挡）
3. 页面加载问题（异步加载、动态内容）
4. 时机问题（操作过快、等待不足）

请提供：
1. 失败原因分析
2. 建议的解决方案
3. 替代定位策略
4. 是否需要等待或重试"""),
                ("human", """操作记录：
- 类型: {action_type}
- 描述: {description}
- 元素: {element_info}
- 错误: {error_message}

页面信息：
- URL: {url}
- 标题: {title}
- 内容片段: {content}

请分析失败原因并提供建议。""")
            ])
            
            messages = prompt.format_messages(
                action_type=record.type,
                description=record.description,
                element_info=json.dumps(record.element.dict(), ensure_ascii=False),
                error_message=error_message,
                url=page_info.get('url', ''),
                title=page_info.get('title', ''),
                content=page_info.get('content', '')[:500]
            )
            
            response = self.llm.invoke(messages)
            analysis = response.content
            
            return {
                'analysis': analysis,
                'suggestions': self._extract_suggestions(analysis),
                'confidence': 0.8
            }
            
        except Exception as e:
            logger.warning(f"AI分析失败: {e}")
            return self._default_failure_analysis(record, error_message)
    
    def suggest_alternative_selectors(self, record: LearningRecord, 
                                    page_content: str) -> List[Dict[str, str]]:
        """建议替代选择器"""
        if not self.is_available():
            return []
        
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", """你是一个网页元素定位专家。根据页面内容和元素信息，提供替代的CSS选择器。

要求：
1. 提供多种选择器策略
2. 按可靠性排序
3. 考虑元素的唯一性和稳定性
4. 避免过于复杂的选择器"""),
                ("human", """元素信息：
{element_info}

页面内容片段：
{page_content}

请提供3-5个替代的CSS选择器，按可靠性排序。""")
            ])
            
            messages = prompt.format_messages(
                element_info=json.dumps(record.element.dict(), ensure_ascii=False),
                page_content=page_content[:1000]
            )
            
            response = self.llm.invoke(messages)
            suggestions = self._parse_selector_suggestions(response.content)
            
            return suggestions
            
        except Exception as e:
            logger.warning(f"AI选择器建议失败: {e}")
            return []
    
    def decide_retry_strategy(self, results: List[ReplayResult], 
                            current_record: LearningRecord) -> Dict[str, Any]:
        """决定重试策略"""
        if not self.is_available():
            return self._default_retry_strategy()
        
        try:
            # 分析最近的失败记录
            recent_failures = [r for r in results[-5:] if not r.success]
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", """你是一个自动化测试策略专家。根据最近的失败记录，决定是否继续重试以及如何调整策略。

考虑因素：
1. 失败模式（连续失败、间歇性失败）
2. 失败原因（定位问题、状态问题、时机问题）
3. 重试成本（时间、资源）
4. 成功概率"""),
                ("human", """最近的失败记录：
{failure_summary}

当前操作：
{current_record}

请决定：
1. 是否继续重试
2. 重试次数
3. 策略调整建议
4. 是否跳过此操作""")
            ])
            
            failure_summary = "\n".join([
                f"- {r.record.description}: {r.error_message}"
                for r in recent_failures
            ])
            
            messages = prompt.format_messages(
                failure_summary=failure_summary,
                current_record=json.dumps(current_record.dict(), ensure_ascii=False)
            )
            
            response = self.llm.invoke(messages)
            strategy = self._parse_retry_strategy(response.content)
            
            return strategy
            
        except Exception as e:
            logger.warning(f"AI重试策略决策失败: {e}")
            return self._default_retry_strategy()
    
    def validate_page_state(self, expected_elements: List[Dict[str, Any]], 
                           actual_page_info: Dict[str, Any]) -> Dict[str, Any]:
        """验证页面状态是否符合预期"""
        if not self.is_available():
            return {'valid': True, 'confidence': 0.5}
        
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", """你是一个网页状态验证专家。检查当前页面状态是否符合预期。

验证要点：
1. 页面标题和URL
2. 关键元素是否存在
3. 页面内容是否匹配
4. 是否有错误信息"""),
                ("human", """预期元素：
{expected_elements}

实际页面信息：
{actual_page_info}

请验证页面状态是否符合预期。""")
            ])
            
            messages = prompt.format_messages(
                expected_elements=json.dumps(expected_elements, ensure_ascii=False),
                actual_page_info=json.dumps(actual_page_info, ensure_ascii=False)
            )
            
            response = self.llm.invoke(messages)
            validation = self._parse_validation_result(response.content)
            
            return validation
            
        except Exception as e:
            logger.warning(f"AI页面状态验证失败: {e}")
            return {'valid': True, 'confidence': 0.5}
    
    def _default_failure_analysis(self, record: LearningRecord, error_message: str) -> Dict[str, Any]:
        """默认的失败分析"""
        return {
            'analysis': f"操作失败: {error_message}",
            'suggestions': [
                '检查元素是否仍然存在',
                '验证元素是否可见和可交互',
                '尝试等待页面加载完成',
                '考虑页面结构是否发生变化'
            ],
            'confidence': 0.5
        }
    
    def _extract_suggestions(self, analysis: str) -> List[str]:
        """从AI分析中提取建议"""
        suggestions = []
        lines = analysis.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith(('-', '•', '1.', '2.', '3.')):
                suggestion = line.lstrip('-•123456789. ')
                if suggestion:
                    suggestions.append(suggestion)
        
        return suggestions if suggestions else ['请检查元素状态和页面结构']
    
    def _parse_selector_suggestions(self, content: str) -> List[Dict[str, str]]:
        """解析选择器建议"""
        suggestions = []
        lines = content.split('\n')
        
        for line in lines:
            line = line.strip()
            if ':' in line and ('#' in line or '.' in line or '[' in line):
                parts = line.split(':', 1)
                if len(parts) == 2:
                    suggestions.append({
                        'type': parts[0].strip(),
                        'selector': parts[1].strip()
                    })
        
        return suggestions
    
    def _parse_retry_strategy(self, content: str) -> Dict[str, Any]:
        """解析重试策略"""
        strategy = {
            'should_retry': True,
            'retry_count': 2,
            'delay': 2.0,
            'skip_current': False
        }
        
        content_lower = content.lower()
        
        if 'skip' in content_lower or '跳过' in content_lower:
            strategy['should_retry'] = False
            strategy['skip_current'] = True
        
        if 'retry' in content_lower or '重试' in content_lower:
            # 尝试提取重试次数
            import re
            retry_match = re.search(r'(\d+)\s*(?:次|times?)', content_lower)
            if retry_match:
                strategy['retry_count'] = int(retry_match.group(1))
        
        return strategy
    
    def _parse_validation_result(self, content: str) -> Dict[str, Any]:
        """解析验证结果"""
        content_lower = content.lower()
        
        if 'valid' in content_lower or '符合' in content_lower or '正确' in content_lower:
            return {'valid': True, 'confidence': 0.8}
        elif 'invalid' in content_lower or '不符合' in content_lower or '错误' in content_lower:
            return {'valid': False, 'confidence': 0.8}
        else:
            return {'valid': True, 'confidence': 0.5}
    
    def _default_retry_strategy(self) -> Dict[str, Any]:
        """默认重试策略"""
        return {
            'should_retry': True,
            'retry_count': 2,
            'delay': 1.0,
            'skip_current': False
        } 