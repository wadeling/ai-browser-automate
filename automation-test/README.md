# AI浏览器自动化测试工具

一个基于Playwright和LangChain的智能自动化测试工具，可以读取浏览器插件导出的学习轨迹JSON文件，并使用AI辅助重放原始操作步骤。

## 🚀 功能特性

- **智能重放**: 使用Playwright重放浏览器操作轨迹
- **AI辅助**: 集成LangChain，提供智能错误分析和恢复
- **多种定位策略**: 支持ID、CSS选择器、XPath、文本等多种元素定位方式
- **灵活配置**: 支持多种浏览器、无头模式、重试机制等
- **详细报告**: 生成完整的测试执行报告和结果分析
- **命令行工具**: 提供易用的命令行接口

## 📋 系统要求

- Python 3.8+
- Chrome/Chromium 浏览器
- OpenAI API密钥（可选，用于AI辅助功能）

## 🛠️ 安装

1. **克隆项目**
```bash
git clone <repository-url>
cd automation-test
```

2. **安装依赖**
```bash
pip install -r requirements.txt
```

3. **安装Playwright浏览器**
```bash
playwright install
```

4. **设置环境变量（可选）**
```bash
export OPENAI_API_KEY="your-openai-api-key"
```

## 📖 使用方法

### 基本命令

```bash
# 重放学习轨迹
python main.py replay data/learning-records.json

# 验证文件格式
python main.py validate data/learning-records.json

# 列出可用文件
python main.py list-files

# 分析文件内容
python main.py analyze data/learning-records.json
```

### 重放命令选项

```bash
python main.py replay data/learning-records.json \
    --browser chromium \
    --headless \
    --slow-mo 1000 \
    --delay 1.0 \
    --retry 3 \
    --start-url "http://example.com" \
    --output results.json \
    --openai-key "your-api-key" \
    --openai-base-url "https://your-api-endpoint.com/v1" \
    --openai-model "gpt-3.5-turbo" \
    --max-tokens 1000
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--browser` | 浏览器类型 (chromium/firefox/webkit) | chromium |
| `--headless` | 无头模式运行 | False |
| `--slow-mo` | 操作间隔时间(毫秒) | 1000 |
| `--timeout` | 超时时间(毫秒) | 30000 |
| `--delay` | 操作间延迟(秒) | 1.0 |
| `--retry` | 重试次数 | 3 |
| `--start-url` | 起始URL | 第一条记录的URL |
| `--output` | 输出结果文件 | 自动生成 |
| `--openai-key` | OpenAI API密钥 | 环境变量 |
| `--openai-base-url` | OpenAI兼容接口的base URL | 环境变量 |
| `--openai-model` | AI模型名称 | gpt-3.5-turbo |
| `--max-tokens` | AI最大token数 | 1000 |

## 🔧 配置

### 环境变量

创建 `.env` 文件来设置配置：

```env
# OpenAI配置
OPENAI_API_KEY=your-openai-api-key
OPENAI_BASE_URL=https://your-api-endpoint.com/v1
OPENAI_MODEL=gpt-3.5-turbo
MAX_TOKENS=1000

# Playwright配置
BROWSER_TYPE=chromium
HEADLESS=false
SLOW_MO=1000
TIMEOUT=30000

# 重放配置
REPLAY_DELAY=1.0
RETRY_COUNT=3
WAIT_FOR_NAVIGATION=true
```

### 配置文件

可以通过修改 `config/settings.py` 来调整默认配置。

## 📊 输出格式

### 重放结果文件

重放完成后会生成JSON格式的结果文件，包含：

```json
{
  "session_id": "abc12345",
  "start_time": "2024-01-01T10:00:00",
  "end_time": "2024-01-01T10:05:00",
  "total_records": 10,
  "successful_records": 8,
  "failed_records": 2,
  "results": [
    {
      "record": {
        "type": "click",
        "description": "点击登录按钮",
        "url": "http://example.com/login",
        "element": {
          "tagName": "BUTTON",
          "id": "login-btn",
          "xpath": "//button[@id='login-btn']",
          "selector": "#login-btn"
        }
      },
      "success": true,
      "execution_time": 1.2,
      "retry_count": 0,
      "selector_used": "id"
    }
  ],
  "summary": {
    "session_id": "abc12345",
    "duration_seconds": 300.0,
    "success_rate": 0.8,
    "average_execution_time": 1.1,
    "browser_type": "chromium",
    "headless": false
  }
}
```

## 🤖 AI辅助功能

### OpenAI兼容接口支持

工具支持使用OpenAI兼容的API接口，如：
- Azure OpenAI
- 本地部署的OpenAI兼容服务
- 第三方AI服务提供商

使用示例：

```bash
# 使用Azure OpenAI
python main.py replay data/test.json \
    --openai-key "your-azure-key" \
    --openai-base-url "https://your-resource.openai.azure.com/openai/deployments/your-deployment" \
    --openai-model "gpt-35-turbo"

# 使用本地部署的服务
python main.py replay data/test.json \
    --openai-key "your-api-key" \
    --openai-base-url "http://localhost:8000/v1" \
    --openai-model "qwen-turbo"
```

### 错误分析

当操作失败时，AI会分析失败原因并提供建议：

- 元素定位问题分析
- 页面状态验证
- 替代选择器建议
- 重试策略优化

### 智能恢复

AI可以：

- 建议替代的元素定位策略
- 分析页面结构变化
- 提供等待和重试建议
- 决定是否跳过失败的操作

## 🧪 测试示例

### 1. 准备测试数据

首先使用浏览器插件记录操作轨迹，导出JSON文件到 `data/` 目录。

### 2. 验证数据

```bash
python main.py validate data/my-test-records.json
```

### 3. 执行重放

```bash
python main.py replay data/my-test-records.json --headless
```

### 4. 查看结果

```bash
python main.py analyze data/my-test-records.json
```

## 🔍 故障排除

### 常见问题

1. **元素定位失败**
   - 检查页面结构是否发生变化
   - 尝试使用不同的定位策略
   - 启用AI辅助功能获取建议

2. **页面加载超时**
   - 增加超时时间设置
   - 检查网络连接
   - 验证URL是否可访问

3. **浏览器启动失败**
   - 确保已安装Playwright浏览器
   - 检查浏览器路径设置
   - 尝试使用不同的浏览器类型

### 调试模式

启用详细日志：

```bash
export LOG_LEVEL=DEBUG
python main.py replay data/test.json
```

## 📁 项目结构

```
automation-test/
├── src/                    # 源代码
│   ├── __init__.py
│   ├── models.py          # 数据模型
│   ├── data_loader.py     # 数据加载器
│   ├── element_locator.py # 元素定位器
│   ├── action_executor.py # 操作执行器
│   ├── ai_assistant.py    # AI助手
│   └── replay_engine.py   # 重放引擎
├── config/                # 配置文件
│   └── settings.py
├── data/                  # 数据目录
├── tests/                 # 测试文件
├── main.py               # 命令行接口
├── requirements.txt      # 依赖列表
└── README.md            # 说明文档
```

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个工具！

## 📄 许可证

MIT License

## 🔗 相关项目

- [Playwright](https://playwright.dev/) - 浏览器自动化框架
- [LangChain](https://langchain.com/) - AI应用开发框架
- [AI浏览器自动化助手](browser-extension/) - 浏览器插件 