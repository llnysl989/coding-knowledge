with open('/Users/zyb/project/coding-knowledge/advertising/knowledge.md', 'r') as f:
    content = f.read()

# Remove chapter 5 (实际案例讲解), rename chapter 6 (开屏广告完整链路详解) to chapter 5
before_ch5, after_ch5 = content.split('## 5. 实际案例讲解', 1)
_ch5_body, ch6_and_after = after_ch5.split('## 6. 开屏广告完整链路详解', 1)

# Now rename sub-headers from 6.x to 5.x in ch6_and_after
# First protect the main "## 6." header by marking it
new_content = before_ch5 + '## 5. 开屏广告完整链路详解' + ch6_and_after
# Now fix sub-numbering: ### 6.1 -> ### 5.1, etc.
import re
new_content = re.sub(r'^### 6\.(\d)', r'### 5.\1', new_content, flags=re.MULTILINE)

with open('/Users/zyb/project/coding-knowledge/advertising/knowledge.md', 'w') as f:
    f.write(new_content)

print('Done')