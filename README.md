# X3 日漫转换器 / X3 Japanese Manga Converter

[在线使用 / Open the converter](https://zukuxi.github.io/MangaToX3/)

## 中文说明

将日本漫画图片文件夹、PDF、ZIP、CBZ、EPUB 转换为 Xteink X3 可读取的 XTC（黑白）或 XTCH（4 灰阶）文件。图像处理和文件转换均在浏览器本地完成，漫画图片不会上传到服务器。

### 功能

- 输入：漫画图片文件夹、多选图片，以及 PDF、ZIP、CBZ、EPUB。
- PDF 使用 PDF.js 逐页渲染；ZIP、CBZ、EPUB 使用 zip.js 按需读取，不会一次性解压全部图片。
- EPUB 优先按 OPF spine 阅读顺序提取内容，并兼容 XHTML 中引用的漫画图片。
- 自动识别章节文件夹，按自然数字顺序排列章节和图片。
- 输出方式：每章单独一本、整部合并、指定章节范围合并、每 N 章合并。
- 输出格式：XTC 黑白或 XTCH 4 灰阶。
- 图像处理：Atkinson、Floyd–Steinberg、Sierra Lite、Ordered/Bayer 4×4、无抖动；可调亮度、对比度、抖动强度和黑白阈值。
- 转换前生成最多 10 页预览；支持取消转换、选择输出文件夹自动保存，或最后下载 ZIP。
- 封面始终保持竖屏、不进行分割；可设置封面之后前 N 张图片保持整页。
- 彩页自动整页保留。
- 普通单页可选择整页、分成 2 份或 3 份。
- 白边裁切支持普通和积极两种模式。
- 宽幅双页扫描会尝试检测中央白色中缝；识别成功时按日漫阅读顺序先输出右页，再输出左页。也可开启整本双页扫描，强制按中线拆分。

### 图片缩放与分割

- **保持原图比例（默认）**：按比例缩放，不拉伸画面；空余区域留白。此模式显示“分割重叠像素”设置，可自行调整相邻视窗的重复范围。三分割会使用三个纵向位置的视窗，优先保留画面完整。
- **铺满屏幕**：页面填满 X3 的 528 × 792 显示区域。此模式隐藏手动“分割重叠像素”设置，使用内部切分参数；三分割时会微调切线，尽量避开横向墨线、对白框边缘和分格线。铺满屏幕可能改变画面比例或裁去部分边缘内容。
- 两种缩放模式均适用于普通单页分割和双页扫描拆分。封面及设置为不分割的前 N 页仍保持竖屏。

### 使用方法

1. 打开上方 GitHub Pages 页面。
2. 选择包含章节子文件夹的漫画总文件夹；也可选择 PDF、ZIP、CBZ、EPUB，或多选图片文件。
3. 检查章节识别结果和前 10 页预览。
4. 选择单页整页、2 份或 3 份；按需设置封面之后不分割的页数、双页扫描和白边裁切方式。
5. 选择图片缩放方式。保持原图比例时可调整重叠像素；铺满屏幕时该设置会自动隐藏。
6. 选择每章一本、整部合并、章节范围或每 N 章合并。
7. 选择 XTC / XTCH，调整图像参数，然后开始转换。

### 内存与文件处理

压缩包只建立文件索引，转换时才读取当前图片；PDF 页面按需渲染。页面处理完成后会释放临时图片和 Canvas，避免将整本漫画的解码图片同时放入内存。第三方库通过 CDN 按需加载，因此首次使用需要网络连接。

### 分割算法说明

日漫分割实现参考并复用配套测试工具 [`zukuxi/imagesplittest`](https://github.com/zukuxi/imagesplittest) 中的相关处理思路，包括彩页识别、白边裁切、双页中缝检测、右页优先输出、2/3 份视窗和三分割切线微调。保持原图比例模式优先保证比例和画面完整；铺满屏幕模式则更适合进行切线位置优化。本项目不使用条漫长图拼接、连续分页或章节内长画布拼接逻辑。

### 版本

V4.1：增加 PDF、ZIP、CBZ、EPUB 输入；保留图片文件夹输入、日漫分割和 XTC / XTCH 输出流程。

### 致谢与许可

- XTC 编码和阅读器实现参考 [`srokl/xtcjsapp`](https://github.com/srokl/xtcjsapp)（MIT）。
- 日漫分割测试工具：[`zukuxi/imagesplittest`](https://github.com/zukuxi/imagesplittest)。
- PDF.js 和 zip.js 通过其公开 CDN 版本加载。
- 本项目保留原有 LICENSE；参考项目的版权和许可按其各自许可执行。

---

## English Documentation

Convert Japanese manga image folders, PDF, ZIP, CBZ, and EPUB files into XTC (1-bit black and white) or XTCH (4-level grayscale) files readable by the Xteink X3. Image processing and conversion run locally in your browser. Manga images are never uploaded to a server.

### Features

- **Input formats:** manga image folders, multiple image files, PDF, ZIP, CBZ, and EPUB.
- PDF files are rendered page by page with PDF.js. ZIP, CBZ, and EPUB archives are read on demand with zip.js; the entire archive is not extracted into memory at once.
- EPUB content is extracted in OPF spine reading order where available, including manga images referenced from XHTML documents.
- Detects chapter folders and sorts chapters and images using natural numeric order.
- **Output grouping:** one book per chapter, merge the whole series, merge a selected chapter range, or combine every N chapters.
- **Output formats:** XTC (1-bit black and white) and XTCH (4-level grayscale).
- **Image processing:** Atkinson, Floyd–Steinberg, Sierra Lite, Ordered/Bayer 4×4, and no dithering. Brightness, contrast, dithering strength, and black-and-white threshold are adjustable.
- Generates up to 10 preview pages before conversion. Supports cancellation, automatic saving to a selected output folder where supported, and ZIP download as a fallback.
- The cover is always kept in portrait orientation and is never split. You can also keep the first N pages after the cover whole.
- Color pages are automatically kept as full pages.
- Regular pages can be kept whole or split into 2 or 3 views.
- White-border trimming offers Normal and Aggressive modes.
- Wide double-page scans are checked for a central white gutter. When detected, pages are emitted in Japanese reading order: right page first, then left page. You can also enable Whole-book double-page scans to force a center split.

### Scaling and Splitting Modes

- **Preserve original aspect ratio (default):** Images are scaled proportionally without stretching. Unused areas remain blank. The **Split overlap (pixels)** control is available in this mode so you can adjust how much adjacent views repeat. Three-way splitting uses three vertical view positions and prioritizes preserving the complete artwork.
- **Fill screen:** Each page fills the X3 display area (528 × 792). The manual **Split overlap (pixels)** control is hidden in this mode; internal split parameters are used instead. For three-way splitting, cut positions are adjusted to avoid horizontal ink lines, speech-balloon borders, and panel borders where possible. Filling the screen may change the image proportions or crop some edge content.
- Both scaling modes work with regular single-page splitting and with pages created by splitting a double-page scan. The cover and any pages configured to remain unsplit stay in portrait orientation.

### How to Use

1. Open the GitHub Pages converter using the link at the top of this README.
2. Select the main manga folder containing chapter subfolders. Alternatively, select a PDF, ZIP, CBZ, or EPUB file, or select multiple image files.
3. Check the detected chapter structure and the first 10 preview pages.
4. Choose full-page output, 2-way splitting, or 3-way splitting. Adjust the number of unsplit pages after the cover, double-page scan handling, and white-border trimming as needed.
5. Choose a scaling mode. The overlap control is available in Preserve original aspect ratio mode and automatically hidden in Fill screen mode.
6. Choose one book per chapter, merge the whole series, merge a chapter range, or combine every N chapters.
7. Select XTC or XTCH, adjust image-processing settings, and start conversion.

### Memory and File Handling

Archives are indexed first, and only the current image is read during conversion. PDF pages are rendered on demand. Temporary images and canvases are released after each page is processed, avoiding simultaneous decoding of the entire manga. Third-party libraries are loaded from public CDNs on demand, so an internet connection is required for the initial load.

### Splitting Algorithm

The manga-splitting implementation draws on the companion test tool [`zukuxi/imagesplittest`](https://github.com/zukuxi/imagesplittest). Related techniques include color-page detection, white-border trimming, double-page gutter detection, right-page-first ordering, 2-way and 3-way views, and cut-line adjustment for three-way splitting. Preserve original aspect ratio prioritizes proportional scaling and keeping the artwork intact; Fill screen is better suited to cut-position optimization. This project does not use long-strip manhwa stitching, continuous pagination, or chapter-long canvas concatenation.

### Version

V4.1: Added PDF, ZIP, CBZ, and EPUB input while retaining image-folder input, Japanese manga splitting, and XTC / XTCH output.

### Credits and License

- XTC encoding and reader implementation reference: [`srokl/xtcjsapp`](https://github.com/srokl/xtcjsapp) (MIT).
- Japanese manga splitting test tool: [`zukuxi/imagesplittest`](https://github.com/zukuxi/imagesplittest).
- PDF.js and zip.js are loaded from their publicly available CDN packages.
- The original project LICENSE is retained. Referenced projects remain subject to their respective licenses.
