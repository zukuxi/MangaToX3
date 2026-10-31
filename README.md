# X3 日漫转换器 / X3 Japanese Manga Converter

将日漫图片文件夹、PDF、ZIP、CBZ、EPUB 转换为 Xteink X3 可读取的 XTC / XTCH 文件。所有图像处理均在浏览器本地完成，不会上传漫画图片。

Convert Japanese manga image folders, PDF, ZIP, CBZ and EPUB files into XTC / XTCH files for Xteink X3. All image processing runs locally in the browser; manga images are never uploaded.

## 功能 / Features

- 支持图片文件夹、多选图片，以及 PDF / ZIP / CBZ / EPUB 单文件输入。
- PDF 使用 PDF.js 逐页渲染；ZIP / CBZ / EPUB 使用 zip.js 按需读取图片，不会一次性解压全部图片。
- EPUB 优先按 OPF spine 阅读顺序提取图片，并兼容 XHTML 中引用的漫画图片。
- 保留文件夹读取、章节识别、自然数字排序。
- 每章单独一本、整部合并、指定章节范围合并、每 N 章合并。
- 输出 XTC（黑白）或 XTCH（4 灰阶）。
- 保留 Atkinson、Floyd–Steinberg、Sierra Lite、Ordered、无抖动，以及亮度、对比度、阈值、抖动强度设置。
- 保留前 5 页预览、取消转换、文件夹自动保存和 ZIP 备用输出。
- 封面始终保持竖屏、不进行日漫分割；可设置封面之后前 N 张图片也保持整页。
- 彩页自动整页保留。
- 普通单页可选择整页、分成 2 份或 3 份。
- 分割视窗按 imagesplittest 的算法保留重叠，并在三分割时微调切线，尽量避开横向墨线、对白框边缘和分格线。
- 宽幅双页扫描会尝试检测中央白色中缝；识别成功时先输出右页，再输出左页。
- 可开启“整本双页扫描”，对没有明显白色中缝的扫描图也按中线拆成右页、左页，再分别应用单页分割设置。
- 白边裁切支持普通与积极两种模式。

## 使用 / Usage

1. 打开 GitHub Pages 页面。
2. 选择包含章节子文件夹的漫画总文件夹；也可直接选择 PDF、ZIP、CBZ、EPUB，或多选图片文件。
3. 检查章节识别结果和前 5 页预览。
4. 在“日漫分割设置”中选择单页整页、2 份或 3 份；按需开启双页扫描、调整重叠像素和白边裁切。
5. 默认封面不切分，默认封面之后前 3 张图片保持竖屏，可按漫画情况修改。
6. 选择每章一本、整部合并、章节范围或每 N 章合并。
7. 选择 XTC / XTCH 和图像参数，点击开始转换。

## 版本 / Version

V4.1：新增 PDF、ZIP、CBZ、EPUB 输入；原有图片文件夹、日漫分割和 XTC / XTCH 输出流程保持不变。

## 文件读取 / Input readers

PDF 使用 PDF.js；ZIP / CBZ / EPUB 使用 zip.js。压缩包只建立文件索引，转换时才读取当前图片；PDF 页面按需渲染。每张页面处理完成后释放临时图片与 Canvas，避免将整本漫画的解码图片同时放入内存。第三方库通过 CDN 按需加载。

## 分割算法 / Splitting algorithm

日漫分割实现参考并复用本项目配套测试工具 `zukuxi/imagesplittest` 中的处理逻辑：彩页识别、白边裁切、双页中缝检测、右页优先输出、2/3 份重叠视窗，以及三分割时的切线避让微调。没有使用条漫长图拼接、连续分页或章节内长画布拼接逻辑。

The manga splitting logic follows the companion `zukuxi/imagesplittest` tool: color-page detection, white-border trimming, spread-gutter detection, right-page-first ordering, overlapping 2/3-view crops, and cut-line adjustment for three-way splits. The original manhwa long-strip stitching and continuous pagination logic has been removed.

## Credits / 致谢

- Original XTC encoding and reader implementation reference: [srokl/xtcjsapp](https://github.com/srokl/xtcjsapp) (MIT). PDF.js and zip.js are loaded from their published CDN packages.
- Japanese manga splitting method: [zukuxi/imagesplittest](https://github.com/zukuxi/imagesplittest).

## License

保留原项目 LICENSE。编码相关部分参考 srokl/xtcjsapp（MIT）；本项目新增日漫分割部分基于作者自己的 imagesplittest 项目实现。
