#!/usr/bin/env python3
"""
AI浏览器自动化测试工具 - 命令行接口
"""
import os
import sys
from pathlib import Path
from typing import Optional
import click
from loguru import logger
from rich.console import Console
from rich.table import Table

# 添加src目录到Python路径
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.models import TestConfig
from src.replay_engine import ReplayEngine
from src.data_loader import LearningDataLoader

console = Console()

@click.group()
@click.version_option(version="1.0.0")
def cli():
    """AI浏览器自动化测试工具
    
    使用浏览器插件记录的操作轨迹进行自动化测试重放
    """
    pass

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--browser', '-b', default='chromium', 
              type=click.Choice(['chromium', 'firefox', 'webkit']),
              help='浏览器类型')
@click.option('--headless', is_flag=True, help='无头模式运行')
@click.option('--slow-mo', default=1000, help='操作间隔时间(毫秒)')
@click.option('--timeout', default=30000, help='超时时间(毫秒)')
@click.option('--delay', default=1.0, help='操作间延迟(秒)')
@click.option('--retry', default=3, help='重试次数')
@click.option('--start-url', help='起始URL')
@click.option('--output', '-o', help='输出结果文件')
@click.option('--openai-key', envvar='OPENAI_API_KEY', help='OpenAI API密钥')
@click.option('--openai-base-url', envvar='OPENAI_BASE_URL', help='OpenAI兼容接口的base URL')
@click.option('--openai-model', envvar='OPENAI_MODEL',default='gpt-3.5-turbo', help='AI模型名称')
@click.option('--max-tokens', envvar='OPENAI_MAX_TOKENS', default=1000, help='AI最大token数')
def replay(file_path, browser, headless, slow_mo, timeout, delay, retry, start_url, output, 
           openai_key, openai_base_url, openai_model, max_tokens):
    """重放学习轨迹文件"""
    
    console.print(f"[bold blue]🤖 AI浏览器自动化测试工具[/bold blue]")
    console.print(f"文件: {file_path}")
    console.print(f"浏览器: {browser}")
    console.print(f"无头模式: {'是' if headless else '否'}")
    console.print()
    
    # 配置
    config = TestConfig(
        browser_type=browser,
        headless=headless,
        slow_mo=slow_mo,
        timeout=timeout,
        replay_delay=delay,
        retry_count=retry,
        openai_api_key=openai_key,
        openai_base_url=openai_base_url,
        openai_model=openai_model,
        max_tokens=max_tokens
    )
    
    try:
        # 创建重放引擎
        with ReplayEngine(config) as engine:
            # 显示AI助手状态
            if engine.ai_assistant.is_available():
                console.print(f"[green]✅ AI助手已启用 (模型: {config.openai_model})[/green]")
                if config.openai_base_url:
                    console.print(f"[green]   使用自定义API端点: {config.openai_base_url}[/green]")
            else:
                console.print("[yellow]⚠️ AI助手未启用[/yellow]")
            
            # 执行重放
            session = engine.replay_from_file(file_path, start_url)
            
            # 保存结果
            if output:
                result_file = engine.save_results(output)
            else:
                result_file = engine.save_results()
            
            console.print(f"\n[green]✅ 重放完成！结果已保存到: {result_file}[/green]")
            
            # 显示详细结果
            show_detailed_results(engine)
            
    except Exception as e:
        console.print(f"[red]❌ 重放失败: {e}[/red]")
        logger.error(f"重放失败: {e}")
        sys.exit(1)

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
def validate(file_path):
    """验证学习轨迹文件"""
    
    console.print(f"[bold blue]🔍 验证学习轨迹文件[/bold blue]")
    console.print(f"文件: {file_path}")
    console.print()
    
    try:
        # 加载数据
        data_loader = LearningDataLoader(Path("data"))
        records = data_loader.load_from_file(file_path)
        
        # 验证数据
        validation = data_loader.validate_records(records)
        
        # 显示验证结果
        table = Table(title="验证结果")
        table.add_column("项目", style="cyan")
        table.add_column("数量", style="magenta")
        table.add_column("状态", style="green")
        
        table.add_row("总记录数", str(validation['total_records']), "")
        table.add_row("有效记录", str(validation['valid_records']), 
                     "✅" if validation['valid_records'] > 0 else "❌")
        table.add_row("无效记录", str(validation['invalid_records']), 
                     "⚠️" if validation['invalid_records'] > 0 else "✅")
        table.add_row("缺少URL", str(validation['missing_urls']), 
                     "❌" if validation['missing_urls'] > 0 else "✅")
        table.add_row("缺少选择器", str(validation['missing_selectors']), 
                     "❌" if validation['missing_selectors'] > 0 else "✅")
        table.add_row("缺少XPath", str(validation['missing_xpath']), 
                     "❌" if validation['missing_xpath'] > 0 else "✅")
        
        console.print(table)
        
        # 显示摘要
        summary = data_loader.get_records_summary(records)
        show_records_summary(summary)
        
        # 显示错误详情
        if validation['errors']:
            console.print("\n[red]错误详情:[/red]")
            for error in validation['errors'][:10]:  # 只显示前10个错误
                console.print(f"  • {error}")
        
    except Exception as e:
        console.print(f"[red]❌ 验证失败: {e}[/red]")
        logger.error(f"验证失败: {e}")
        sys.exit(1)

@cli.command()
@click.option('--data-dir', default='data', help='数据目录')
def list_files(data_dir):
    """列出可用的学习轨迹文件"""
    
    console.print(f"[bold blue]📁 可用的学习轨迹文件[/bold blue]")
    console.print(f"目录: {data_dir}")
    console.print()
    
    try:
        data_loader = LearningDataLoader(Path(data_dir))
        files = data_loader.list_available_files()
        
        if not files:
            console.print("[yellow]没有找到JSON文件[/yellow]")
            return
        
        table = Table(title="学习轨迹文件")
        table.add_column("文件名", style="cyan")
        table.add_column("大小", style="magenta")
        table.add_column("修改时间", style="green")
        table.add_column("记录数", style="yellow")
        
        for file_path in files:
            try:
                # 获取文件信息
                stat = file_path.stat()
                size = stat.st_size
                mtime = stat.st_mtime
                
                # 尝试读取记录数
                records = data_loader.load_from_file(file_path)
                record_count = len(records)
                
                # 格式化显示
                size_str = f"{size / 1024:.1f} KB"
                mtime_str = Path(file_path).stat().st_mtime
                from datetime import datetime
                mtime_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
                
                table.add_row(
                    file_path.name,
                    size_str,
                    mtime_str,
                    str(record_count)
                )
                
            except Exception as e:
                table.add_row(file_path.name, "?", "?", "错误")
        
        console.print(table)
        
    except Exception as e:
        console.print(f"[red]❌ 列出文件失败: {e}[/red]")
        logger.error(f"列出文件失败: {e}")
        sys.exit(1)

@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--type', '-t', multiple=True, help='过滤操作类型')
@click.option('--url', help='过滤URL模式')
def analyze(file_path, type, url):
    """分析学习轨迹文件"""
    
    console.print(f"[bold blue]📊 分析学习轨迹文件[/bold blue]")
    console.print(f"文件: {file_path}")
    console.print()
    
    try:
        # 加载数据
        data_loader = LearningDataLoader(Path("data"))
        records = data_loader.load_from_file(file_path)
        
        # 过滤记录
        if type:
            records = data_loader.filter_records_by_type(records, list(type))
            console.print(f"过滤操作类型: {', '.join(type)}")
        
        if url:
            records = data_loader.filter_records_by_url(records, url)
            console.print(f"过滤URL模式: {url}")
        
        # 获取摘要
        summary = data_loader.get_records_summary(records)
        show_records_summary(summary)
        
        # 显示操作类型分布
        if summary['types']:
            console.print("\n[bold]操作类型分布:[/bold]")
            type_table = Table()
            type_table.add_column("操作类型", style="cyan")
            type_table.add_column("数量", style="magenta")
            type_table.add_column("百分比", style="green")
            
            total = summary['total']
            for op_type, count in summary['types'].items():
                percentage = count / total * 100
                type_table.add_row(op_type, str(count), f"{percentage:.1f}%")
            
            console.print(type_table)
        
        # 显示URL列表
        if summary['urls']:
            console.print(f"\n[bold]涉及的URL ({len(summary['urls'])}个):[/bold]")
            for url in summary['urls'][:5]:  # 只显示前5个
                console.print(f"  • {url}")
            if len(summary['urls']) > 5:
                console.print(f"  ... 还有 {len(summary['urls']) - 5} 个URL")
        
    except Exception as e:
        console.print(f"[red]❌ 分析失败: {e}[/red]")
        logger.error(f"分析失败: {e}")
        sys.exit(1)

def show_records_summary(summary):
    """显示记录摘要"""
    table = Table(title="记录摘要")
    table.add_column("项目", style="cyan")
    table.add_column("值", style="magenta")
    
    table.add_row("总记录数", str(summary['total']))
    
    if summary['types']:
        types_str = ", ".join([f"{k}: {v}" for k, v in summary['types'].items()])
        table.add_row("操作类型", types_str)
    
    if summary['urls']:
        table.add_row("涉及URL数", str(len(summary['urls'])))
    
    if 'time_range' in summary:
        start_time = summary['time_range']['start'].strftime("%Y-%m-%d %H:%M")
        end_time = summary['time_range']['end'].strftime("%Y-%m-%d %H:%M")
        table.add_row("时间范围", f"{start_time} ~ {end_time}")
    
    console.print(table)

def show_detailed_results(engine):
    """显示详细结果"""
    results = engine.get_detailed_results()
    
    if not results:
        return
    
    console.print("\n[bold]详细结果:[/bold]")
    
    # 成功和失败的统计
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    console.print(f"✅ 成功: {len(successful)} 个操作")
    console.print(f"❌ 失败: {len(failed)} 个操作")
    
    # 显示失败的操作
    if failed:
        console.print("\n[red]失败的操作:[/red]")
        fail_table = Table()
        fail_table.add_column("序号", style="cyan")
        fail_table.add_column("操作", style="magenta")
        fail_table.add_column("错误信息", style="red")
        
        for result in failed[:5]:  # 只显示前5个失败
            fail_table.add_row(
                str(result['index']),
                result['description'],
                result['error_message'][:50] + "..." if len(result['error_message']) > 50 else result['error_message']
            )
        
        console.print(fail_table)
        
        if len(failed) > 5:
            console.print(f"... 还有 {len(failed) - 5} 个失败操作")

if __name__ == '__main__':
    cli() 