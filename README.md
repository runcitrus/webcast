# WebCast

Library for automated screencast recording with [Puppeteer](https://github.com/puppeteer/puppeteer)

## Usage

```js
import startWebcast from '@runcitrus/webcast'

async function main() {
    const w = await startWebcast({
        width: 1280,
        height: 800,
        scale: 4,
        recorder: {
            followNewTab: false,
            fps: 60,
            videoCrf: 18,
            videoCodec: 'libx264',
            videoPreset: 'ultrafast',
            aspectRatio: '16:10',
        },
    })

    await w.setMediaFeature('prefers-color-scheme', 'light')

    await w.goto('http://example.com')
    await w.screencast('screen.mp4')

    // click on button or link
    await w.click('button[type=submit]')

    // type text into input with ease-in-out effect
    await w.inputText('input[type=text]', 'text')

    // select file
    await w.inputFile('input[type=file]', '/home/user/example.tar.gz')

    // set option in the select
    await w.selectValue('select', 'option')

    // scroll into element view
    await w.scrollIntoView('#element-id')

    // wait for element
    await w.waitFor('div.success')

    // finalize
    await w.close()
}
```
