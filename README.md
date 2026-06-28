# PDF Annotator Extension 📄🖊️

A powerful, open-source Google Chrome extension that lets you view, edit, and annotate PDFs entirely within your browser! This extension goes beyond basic PDF viewing by offering advanced tools tailored for power users, students, and professionals.

## ✨ Features

- **Robust Annotations:** Add text boxes and image overlays anywhere on your PDFs.
- **Dynamic Resize & Move:** Seamlessly click and drag to resize or move your annotations.
- **Text Formatting:** Full control over font family, size, color, bold, and italic styles.
- **Smart Image Cropping:** Built-in image cropping tool to perfectly fit your overlays.
- **Dark Mode Support:** Beautifully designed Dark Mode UI to protect your eyes.
- **Inversion Fixer Tool:** When viewing PDFs in Dark Mode, some images or diagrams can look inverted and scary. Use the dedicated **Add Fix Inversion** tool to draw a box over any image to restore its original colors instantly!
- **Merge PDFs:** Effortlessly merge multiple PDFs together! A smart modal lets you choose whether to append new pages at the start, at the end, or right after your current page.
- **Undo / Redo:** Full history tracking so you never lose your progress.
- **Save & Export:** Flatten your annotations and export the final PDF with a single click.

## 🚀 Installation

Since this extension is not on the Chrome Web Store, you can easily install it locally in Developer Mode:

1. **Download the code:**
   - Click the green **Code** button at the top of this repository and select **Download ZIP**.
   - Extract the downloaded `.zip` file into a folder on your computer.

2. **Load into Chrome:**
   - Open Google Chrome and type `chrome://extensions/` into the address bar.
   - In the top right corner, toggle **Developer mode** ON.
   - Click the **Load unpacked** button in the top left.
   - Select the extracted folder containing the extension files.

3. **You're done! 🎉** 
   - The PDF Annotator icon should now appear in your extensions menu. Pin it for quick access!

## 🛠️ How to Use the Fix Inversion Tool

Reading PDFs in Dark Mode is great, but inverted images are a nightmare. This tool fixes that!
1. Click the **Fix Inversion ▾** dropdown menu.
2. Select **Add Inversion Box**.
3. Click and drag a box over the inverted image on the PDF.
4. The image inside the box will immediately revert to its original colors!
5. You can adjust the box using the circle resize handles, and then click **Apply** to finalize it. 
*(If you need to edit it later, just select "Edit/Delete Boxes" from the dropdown!)*

## 📄 Built With
* JavaScript (Vanilla ES6)
* HTML5 / CSS3
* [PDF.js](https://mozilla.github.io/pdf.js/)
* [pdf-lib](https://pdf-lib.js.org/)
* [Cropper.js](https://fengyuanchen.github.io/cropperjs/)

## 🤝 Contributing
Feel free to fork this project, submit pull requests, or report issues! Contributions are always welcome.
