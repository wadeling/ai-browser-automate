"""
重放引擎 - 主要的自动化测试执行器
"""
import time
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from playwright.sync_api import sync_playwright, Browser, Page
from loguru import logger
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from .models import LearningRecord, ReplayResult, ReplaySession, TestConfig
from .data_loader import LearningDataLoader
from .element_locator import ElementLocator
from .action_executor import ActionExecutor
from .ai_assistant import AIAssistant

class ReplayEngine:
    """重放引擎 - 执行自动化测试的核心类"""
    
    def __init__(self, config: TestConfig = None):
        self.config = config or TestConfig()
        self.console = Console()
        self.playwright = None
        self.browser = None
        self.page = None
        
        # 初始化组件
        self.data_loader = LearningDataLoader(Path("data"))
        self.ai_assistant = AIAssistant()
        
        # 会话状态
        self.current_session: Optional[ReplaySession] = None
        self.results: List[ReplayResult] = []
        
    def __enter__(self):
        """上下文管理器入口"""
        self.start_browser()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """上下文管理器出口"""
        self.close_browser()
    
    def start_browser(self):
        """启动浏览器"""
        try:
            self.playwright = sync_playwright().start()
            
            browser_type = getattr(self.playwright, self.config.browser_type)
            self.browser = browser_type.launch(
                headless=self.config.headless,
                slow_mo=self.config.slow_mo
            )
            
            self.page = self.browser.new_page()
            self.page.set_default_timeout(self.config.timeout)
            
            logger.info(f"浏览器启动成功: {self.config.browser_type}")
            
        except Exception as e:
            logger.error(f"浏览器启动失败: {e}")
            raise
    
    def close_browser(self):
        """关闭浏览器"""
        try:
            if self.page:
                self.page.close()
            if self.browser:
                self.browser.close()
            if self.playwright:
                self.playwright.stop()
            
            logger.info("浏览器已关闭")
            
        except Exception as e:
            logger.warning(f"关闭浏览器时出错: {e}")
    
    def replay_from_file(self, file_path: str | Path, 
                        start_url: str = None) -> ReplaySession:
        """从文件重放学习轨迹"""
        # 加载数据
        records = self.data_loader.load_from_file(file_path)
        
        # 验证数据
        validation = self.data_loader.validate_records(records)
        self._print_validation_summary(validation)
        
        if validation['valid_records'] == 0:
            raise ValueError("没有有效的记录可以重放")
        
        # 开始重放会话
        session_id = str(uuid.uuid4())[:8]
        self.current_session = ReplaySession(
            session_id=session_id,
            start_time=datetime.now(),
            total_records=len(records),
            successful_records=0,
            failed_records=0
        )
        
        # 导航到起始页面
        if start_url:
            self.page.goto(start_url)
            logger.info(f"导航到起始页面: {start_url}")
        elif records:
            # 使用第一条记录的URL
            first_url = records[0].url
            self.page.goto(first_url)
            logger.info(f"导航到页面: {first_url}")
        
        # 执行重放
        self._execute_replay(records)
        
        # 完成会话
        self.current_session.end_time = datetime.now()
        self.current_session.results = self.results
        self.current_session.successful_records = len([r for r in self.results if r.success])
        self.current_session.failed_records = len([r for r in self.results if not r.success])
        
        # 生成摘要
        self._generate_session_summary()
        
        return self.current_session
    
    def _execute_replay(self, records: List[LearningRecord]):
        """执行重放操作"""
        # 初始化执行器
        executor_config = {
            'replay_delay': self.config.replay_delay,
            'retry_count': self.config.retry_count,
            'wait_for_navigation': self.config.wait_for_navigation,
            'selector_priority': self.config.selector_priority
        }
        
        executor = ActionExecutor(self.page, executor_config)
        
        # 使用进度条显示执行进度
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=self.console
        ) as progress:
            
            task = progress.add_task("执行重放操作...", total=len(records))
            
            for i, record in enumerate(records):
                progress.update(task, description=f"执行操作 {i+1}/{len(records)}: {record.description}")
                
                # 检查是否需要导航
                if i > 0 and record.url != records[i-1].url:
                    try:
                        self.page.goto(record.url)
                        logger.info(f"导航到新页面: {record.url}")
                    except Exception as e:
                        logger.warning(f"页面导航失败: {e}")
                
                # 执行操作
                result = self._execute_single_action(executor, record)
                self.results.append(result)
                
                # 更新进度
                progress.advance(task)
                
                # 如果操作失败且AI可用，尝试分析
                if not result.success and self.ai_assistant.is_available():
                    self._handle_failure_with_ai(executor, record, result)
    
    def _execute_single_action(self, executor: ActionExecutor, 
                              record: LearningRecord) -> ReplayResult:
        """执行单个操作"""
        try:
            result = executor.execute_action(record)
            
            if result.success:
                logger.info(f"✅ 操作成功: {record.description}")
            else:
                logger.warning(f"❌ 操作失败: {record.description} - {result.error_message}")
            
            return result
            
        except Exception as e:
            logger.error(f"执行操作时发生异常: {e}")
            return ReplayResult(
                record=record,
                success=False,
                error_message=str(e),
                execution_time=0.0,
                retry_count=0
            )
    
    def _handle_failure_with_ai(self, executor: ActionExecutor, 
                               record: LearningRecord, result: ReplayResult):
        """使用AI处理失败情况"""
        try:
            # 获取页面信息
            page_info = executor.get_page_info()
            
            # AI分析失败原因
            analysis = self.ai_assistant.analyze_failure(
                record, result.error_message, page_info
            )
            
            logger.info(f"AI分析结果: {analysis['analysis']}")
            
            # 如果AI建议重试，尝试使用替代选择器
            if analysis.get('suggestions'):
                self._try_alternative_selectors(executor, record, analysis)
                
        except Exception as e:
            logger.warning(f"AI处理失败: {e}")
    
    def _try_alternative_selectors(self, executor: ActionExecutor, 
                                 record: LearningRecord, analysis: Dict[str, Any]):
        """尝试使用替代选择器"""
        try:
            # 获取页面内容
            page_content = self.page.content()
            
            # AI建议替代选择器
            suggestions = self.ai_assistant.suggest_alternative_selectors(
                record, page_content
            )
            
            if suggestions:
                logger.info(f"尝试 {len(suggestions)} 个替代选择器")
                
                for suggestion in suggestions:
                    try:
                        # 这里需要修改ElementLocator来支持自定义选择器
                        # 暂时跳过，可以在后续版本中实现
                        logger.debug(f"建议选择器: {suggestion}")
                    except Exception as e:
                        logger.debug(f"替代选择器失败: {e}")
                        continue
                        
        except Exception as e:
            logger.warning(f"尝试替代选择器失败: {e}")
    
    def _print_validation_summary(self, validation: Dict[str, Any]):
        """打印验证摘要"""
        table = Table(title="数据验证结果")
        table.add_column("项目", style="cyan")
        table.add_column("数量", style="magenta")
        
        table.add_row("总记录数", str(validation['total_records']))
        table.add_row("有效记录", str(validation['valid_records']))
        table.add_row("无效记录", str(validation['invalid_records']))
        table.add_row("缺少URL", str(validation['missing_urls']))
        table.add_row("缺少选择器", str(validation['missing_selectors']))
        table.add_row("缺少XPath", str(validation['missing_xpath']))
        
        self.console.print(table)
        
        if validation['errors']:
            self.console.print("\n[red]错误详情:[/red]")
            for error in validation['errors'][:5]:  # 只显示前5个错误
                self.console.print(f"  • {error}")
    
    def _generate_session_summary(self):
        """生成会话摘要"""
        if not self.current_session:
            return
        
        duration = (self.current_session.end_time - self.current_session.start_time).total_seconds()
        
        summary = {
            'session_id': self.current_session.session_id,
            'duration_seconds': duration,
            'success_rate': self.current_session.successful_records / self.current_session.total_records,
            'average_execution_time': sum(r.execution_time for r in self.results) / len(self.results) if self.results else 0,
            'browser_type': self.config.browser_type,
            'headless': self.config.headless
        }
        
        self.current_session.summary = summary
        
        # 打印摘要
        self._print_session_summary()
    
    def _print_session_summary(self):
        """打印会话摘要"""
        if not self.current_session:
            return
        
        table = Table(title="重放会话摘要")
        table.add_column("项目", style="cyan")
        table.add_column("值", style="magenta")
        
        table.add_row("会话ID", self.current_session.session_id)
        table.add_row("总操作数", str(self.current_session.total_records))
        table.add_row("成功操作", str(self.current_session.successful_records))
        table.add_row("失败操作", str(self.current_session.failed_records))
        table.add_row("成功率", f"{self.current_session.successful_records / self.current_session.total_records * 100:.1f}%")
        table.add_row("执行时间", f"{self.current_session.summary['duration_seconds']:.1f}秒")
        table.add_row("浏览器", self.config.browser_type)
        
        self.console.print(table)
    
    def save_results(self, output_file: str = None) -> str:
        """保存结果到文件"""
        if not self.current_session:
            raise ValueError("没有可保存的会话结果")
        
        if not output_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"replay_results_{self.current_session.session_id}_{timestamp}.json"
        
        output_path = Path("data") / output_file
        output_path.parent.mkdir(exist_ok=True)
        
        # 转换为可序列化的格式
        session_data = self.current_session.dict()
        session_data['start_time'] = session_data['start_time'].isoformat()
        session_data['end_time'] = session_data['end_time'].isoformat()
        
        for result in session_data['results']:
            result['record']['timestamp'] = result['record']['timestamp'].isoformat()
        
        import json
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"结果已保存到: {output_path}")
        return str(output_path)
    
    def get_detailed_results(self) -> List[Dict[str, Any]]:
        """获取详细结果"""
        if not self.results:
            return []
        
        detailed_results = []
        for i, result in enumerate(self.results):
            detailed_result = {
                'index': i + 1,
                'type': result.record.type,
                'description': result.record.description,
                'url': result.record.url,
                'success': result.success,
                'execution_time': result.execution_time,
                'retry_count': result.retry_count,
                'selector_used': result.selector_used,
                'error_message': result.error_message,
                'element_info': result.record.element.dict()
            }
            detailed_results.append(detailed_result)
        
        return detailed_results 