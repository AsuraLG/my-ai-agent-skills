import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "fetch.py"
spec = importlib.util.spec_from_file_location("fetch_module", MODULE_PATH)
fetch_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch_module)


class FetchScriptTest(unittest.TestCase):
    def test_extract_link_paths_returns_all_redirect_links(self) -> None:
        html = '''
        <a href="/link?url=abc">A</a>
        <a href="/link?url=def">B</a>
        '''

        links = fetch_module.extract_link_paths(html)

        self.assertEqual(links, ["/link?url=abc", "/link?url=def"])

    def test_extract_content_preserves_paragraph_breaks(self) -> None:
        html = '''
        <div id="js_content">
            <p>第一段</p>
            <p>第二段 <strong>加粗</strong></p>
            <p>第三段</p>
        </div>
        '''

        content = fetch_module.extract_content(html)

        self.assertEqual(content, "第一段\n第二段 加粗\n第三段")

    def test_extract_content_filters_common_wechat_noise(self) -> None:
        html = '''
        <div id="js_content">
            <p>这是正文第一段</p>
            <p>阅读原文</p>
            <p>微信扫一扫关注该公众号</p>
            <p>这是正文第二段</p>
        </div>
        '''

        content = fetch_module.extract_content(html)

        self.assertEqual(content, "这是正文第一段\n这是正文第二段")

    def test_extract_content_filters_real_world_footer_noise(self) -> None:
        html = '''
        <div id="js_content">
            <p>这是正文第一段</p>
            <p>这是正文第二段</p>
            <p>本内容为作者独立观点，不代表虎嗅立场。</p>
            <p>End</p>
            <p>想涨知识 关注虎嗅视频号！</p>
            <p>如对本稿件有异议或投诉，请联系 tougao@huxiu.com</p>
        </div>
        '''

        content = fetch_module.extract_content(html)

        self.assertEqual(content, "这是正文第一段\n这是正文第二段")

    def test_extract_content_filters_recommendation_block_lines(self) -> None:
        html = '''
        <div id="js_content">
            <p>保留的正文段落</p>
            <p>21君荐读</p>
            <p>往期推荐</p>
            <p>期待关注</p>
            <p>另一段正文</p>
        </div>
        '''

        content = fetch_module.extract_content(html)

        self.assertEqual(content, "保留的正文段落\n另一段正文")

    def test_extract_content_filters_editorial_credit_lines(self) -> None:
        html = '''
        <div id="js_content">
            <p>保留的正文段落</p>
            <p>出品丨虎嗅商业消费组</p>
            <p>作者丨张三</p>
            <p>编辑丨李四</p>
            <p>微信统筹丨王五</p>
            <p>另一段正文</p>
        </div>
        '''

        content = fetch_module.extract_content(html)

        self.assertEqual(content, "保留的正文段落\n另一段正文")

    def test_extract_content_filters_more_recommendation_variants(self) -> None:
        html = '''
        <div id="js_content">
            <p>保留的正文段落</p>
            <p>相关阅读</p>
            <p>延伸阅读</p>
            <p>推荐阅读</p>
            <p>扫码关注</p>
            <p>关注我们</p>
            <p>另一段正文</p>
        </div>
        '''

        content = fetch_module.extract_content(html)

        self.assertEqual(content, "保留的正文段落\n另一段正文")

    def test_extract_content_converts_br_to_newline(self) -> None:
        html = '''
        <div id="js_content">第一行<br>第二行<br/>第三行</div>
        '''

        content = fetch_module.extract_content(html)

        self.assertEqual(content, "第一行\n第二行\n第三行")

    def test_format_publish_time_formats_unix_timestamp(self) -> None:
        formatted = fetch_module.format_publish_time("1710000000")

        self.assertEqual(formatted, "2024-03-10 00:00:00")

    def test_format_publish_time_preserves_readable_text(self) -> None:
        formatted = fetch_module.format_publish_time("2024年3月9日")

        self.assertEqual(formatted, "2024年3月9日")

    def test_format_publish_time_returns_empty_string_when_missing(self) -> None:
        formatted = fetch_module.format_publish_time("")

        self.assertEqual(formatted, "")

    def test_extract_metadata_returns_account_publish_time_and_author(self) -> None:
        html = '''
        <html>
            <meta property="og:title" content="示例标题" />
            <meta property="og:article:author" content="示例公众号" />
            <script>
                var ct = "1710000000";
                var nickname = htmlDecode("示例公众号");
                var user_name = "示例作者";
            </script>
        </html>
        '''

        metadata = fetch_module.extract_metadata(html)

        self.assertEqual(
            metadata,
            {
                "account_name": "示例公众号",
                "publish_time": "2024-03-10 00:00:00",
                "author": "示例作者",
            },
        )

    def test_extract_metadata_returns_empty_strings_when_missing(self) -> None:
        metadata = fetch_module.extract_metadata("<html></html>")

        self.assertEqual(
            metadata,
            {
                "account_name": "",
                "publish_time": "",
                "author": "",
            },
        )

    def test_build_session_uses_no_proxy_by_default(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            session = fetch_module.build_session()

        self.assertEqual(session.proxies, {})

    def test_build_session_uses_proxy_from_environment(self) -> None:
        proxy = "http://proxy.example.com:8080"
        with patch.dict(os.environ, {"WECHAT_ARTICLE_FETCH_PROXY": proxy}, clear=True):
            session = fetch_module.build_session()

        self.assertEqual(session.proxies, {"http": proxy, "https": proxy})

    def test_normalize_limit_caps_value_at_ten(self) -> None:
        self.assertEqual(fetch_module.normalize_limit(20), 10)

    def test_normalize_limit_keeps_valid_value(self) -> None:
        self.assertEqual(fetch_module.normalize_limit(6), 6)

    def test_normalize_limit_raises_for_non_positive_value(self) -> None:
        with self.assertRaisesRegex(ValueError, "greater than 0"):
            fetch_module.normalize_limit(0)


if __name__ == "__main__":
    unittest.main()
