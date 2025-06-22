"""
数据加载器 - 读取插件导出的学习轨迹JSON文件
"""
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from loguru import logger

from .models import LearningRecord, ElementInfo, Position

class LearningDataLoader:
    """学习数据加载器"""
    
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
    
    def load_from_file(self, file_path: str | Path) -> List[LearningRecord]:
        """从JSON文件加载学习数据"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        logger.info(f"正在加载学习数据: {file_path}")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            records = []
            for item in data:
                try:
                    record = self._parse_record(item)
                    records.append(record)
                except Exception as e:
                    logger.warning(f"解析记录失败: {e}, 跳过此记录")
                    continue
            
            logger.info(f"成功加载 {len(records)} 条记录")
            return records
            
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON文件格式错误: {e}")
        except Exception as e:
            raise RuntimeError(f"加载文件失败: {e}")
    
    def _parse_record(self, item: Dict[str, Any]) -> LearningRecord:
        """解析单条记录"""
        # 解析元素信息
        element_data = item.get('element', {})
        element = ElementInfo(
            tagName=element_data.get('tagName', ''),
            id=element_data.get('id'),
            className=element_data.get('className'),
            textContent=element_data.get('textContent'),
            placeholder=element_data.get('placeholder'),
            type=element_data.get('type'),
            action=element_data.get('action'),
            xpath=element_data.get('xpath', ''),
            selector=element_data.get('selector', '')
        )
        
        # 解析位置信息
        position = None
        if 'position' in item:
            pos_data = item['position']
            position = Position(x=pos_data['x'], y=pos_data['y'])
        
        # 解析时间戳
        timestamp_str = item.get('timestamp', '')
        if isinstance(timestamp_str, str):
            try:
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            except ValueError:
                timestamp = datetime.now()
        else:
            timestamp = datetime.now()
        
        return LearningRecord(
            type=item.get('type', ''),
            description=item.get('description', ''),
            url=item.get('url', ''),
            element=element,
            timestamp=timestamp,
            position=position,
            value=item.get('value')
        )
    
    def list_available_files(self) -> List[Path]:
        """列出可用的JSON文件"""
        json_files = list(self.data_dir.glob("*.json"))
        return sorted(json_files, key=lambda x: x.stat().st_mtime, reverse=True)
    
    def validate_records(self, records: List[LearningRecord]) -> Dict[str, Any]:
        """验证记录数据的完整性"""
        validation_result = {
            'total_records': len(records),
            'valid_records': 0,
            'invalid_records': 0,
            'missing_urls': 0,
            'missing_selectors': 0,
            'missing_xpath': 0,
            'errors': []
        }
        
        for i, record in enumerate(records):
            is_valid = True
            
            # 检查必要字段
            if not record.url:
                validation_result['missing_urls'] += 1
                validation_result['errors'].append(f"记录 {i+1}: 缺少URL")
                is_valid = False
            
            if not record.element.selector:
                validation_result['missing_selectors'] += 1
                validation_result['errors'].append(f"记录 {i+1}: 缺少CSS选择器")
                is_valid = False
            
            if not record.element.xpath:
                validation_result['missing_xpath'] += 1
                validation_result['errors'].append(f"记录 {i+1}: 缺少XPath")
                is_valid = False
            
            if is_valid:
                validation_result['valid_records'] += 1
            else:
                validation_result['invalid_records'] += 1
        
        return validation_result
    
    def filter_records_by_type(self, records: List[LearningRecord], record_types: List[str]) -> List[LearningRecord]:
        """按类型过滤记录"""
        return [record for record in records if record.type in record_types]
    
    def filter_records_by_url(self, records: List[LearningRecord], url_pattern: str) -> List[LearningRecord]:
        """按URL模式过滤记录"""
        return [record for record in records if url_pattern in record.url]
    
    def get_records_summary(self, records: List[LearningRecord]) -> Dict[str, Any]:
        """获取记录摘要信息"""
        if not records:
            return {'total': 0, 'types': {}, 'urls': set()}
        
        types_count = {}
        urls = set()
        
        for record in records:
            # 统计操作类型
            record_type = record.type
            types_count[record_type] = types_count.get(record_type, 0) + 1
            
            # 收集URL
            urls.add(record.url)
        
        return {
            'total': len(records),
            'types': types_count,
            'urls': list(urls),
            'time_range': {
                'start': min(record.timestamp for record in records),
                'end': max(record.timestamp for record in records)
            }
        } 