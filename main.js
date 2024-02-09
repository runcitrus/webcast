import puppeteer from 'puppeteer'
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder'

const screenWidth = 1280
const screenHeight = 800
const cursorSize = 20
let mouseX = 0
let mouseY = 0

const screenRecorderConfig = {
    followNewTab: true,
    fps: 60,
    ffmpeg_Path: '/opt/homebrew/bin/ffmpeg',
    videoCrf: 18,
    videoCodec: 'libx264',
    videoPreset: 'ultrafast',
    autopad: {
        color: 'black' | '#35A5FF',
    },
    aspectRatio: '' + screenWidth + ':' + screenHeight,
}

/**
 *
 * @param {number} ms
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 *
 * @param {number} pos
 * @param {number} len
 * @param {number} base
 * @returns {number}
 */
const easeInOut = (pos, len, base) => (base + (1 - Math.sin((pos / len) * Math.PI)) * base)

/**
 * @param {number} delay
 * @param {number} pos
 * @param {number} len
 * @param {number} speed
 * @returns {Promise<number>}
 */
async function easeInOutSleep(acc, pos, len, speed) {
    const delayStep = easeInOut(pos, len, speed)
    acc += delayStep
    if(acc >= 1) {
        const roundedDelay = Math.floor(acc)
        await sleep(roundedDelay)
        acc -= roundedDelay
    }
    return acc
}

/**
 *
 * @param {import('puppeteer').Page} page
 * @param {string} text
 * @param {number} speed
 */
async function typing(page, selector, text) {
    console.log('  > typing', text)

    await page.focus(selector)

    let delay = 0

    for(let i = 0; i < text.length; i++) {
        await page.keyboard.type(text[i])
        delay = await easeInOutSleep(delay, i, text.length, 40)
    }
}

/**
 *
 * @param {import('puppeteer').Page} page
 */
async function mouseInit(page) {
    console.log('init cursor')
    await page.evaluate((size) => {
        const cursor = document.createElement('div')
        cursor.id = 'screen-cursor'
        cursor.style.pointerEvents = 'none' // Ensures the cursor doesn't block clicks
        cursor.style.zIndex = '9999'        // Ensures the cursor is always on top
        cursor.style.background = 'black'   // Set color
        cursor.style.opacity = '0.5'        // Set opacity
        cursor.style.width = size + 'px'     // Set size
        cursor.style.height = size + 'px'
        cursor.style.borderRadius = '50%'   // Makes it a circle
        cursor.style.position = 'fixed'     // Allows it to move freely
        cursor.style.display = 'none'       // Hide it initially
        document.body.append(cursor)
    }, cursorSize)
}

/**
 * @param {import('puppeteer').Page} page
 * @param {number} x
 * @param {number} y
 */
async function mouseMove(page, x, y) {
    mouseX = x
    mouseY = y
    await page.mouse.move(x, y)
}

async function mouseClick(page) {
    await page.evaluate((x, y, size) => {
        const cursor = document.getElementById('screen-cursor')
        const r = size / 2
        cursor.style.left = (x - r) + 'px'
        cursor.style.top = (y - r) + 'px'
        cursor.style.display = 'block'
        setTimeout(() => {
            cursor.style.display = 'none'
        }, 500)
    }, mouseX, mouseY, cursorSize)

    await sleep(200)
    await page.mouse.down()
    await page.mouse.up()
}

/**
 *
 * @param {import('puppeteer').Page} page
 * @param {string} selector
 */
async function elementClick(page, selector) {
    const element = await page.$(selector)
    if(!element) {
        throw new Error('Element not found: ' + selector)
    }

    const box = await element.boundingBox()
    if(!box) {
        throw new Error('Element not visible: ' + selector)
    }

    console.log('  > click on', selector)

    const x = Math.round(box.x + box.width / 2)
    const y = Math.round(box.y + box.height / 2)

    await mouseMove(page, x, y)
    await page.focus(selector)

    await mouseClick(page)
}

/**
 *
 * @param {import('puppeteer').Page} page
 * @param {string} selector
 */
async function elementScrollIntoView(page, selector) {
    const element = await page.$(selector)
    if(!element) {
        throw new Error('Element not found: ' + selector)
    }

    console.log('  > scroll to', selector)

    await element.scrollIntoView()
}

async function main() {
    console.log('start')
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.setViewport({
        width: screenWidth,
        height: screenHeight,
        deviceScaleFactor: 4,
    })

    const recorder = new PuppeteerScreenRecorder(page, screenRecorderConfig)

    const lookAroundDelay = 1000

    // Open page
    const url = 'http://d1.cesbo.net'
    console.log('open', url)
    await page.goto(url)
    await page.waitForNetworkIdle()
    await mouseInit(page)

    // Init screen recorder
    await recorder.start('screen.mp4')

    // Login if needed
    if(await page.$('#password')) {
        await sleep(lookAroundDelay)
        console.log('log in as admin')
        await typing(page, '#name', 'admin')
        await typing(page, '#password', 'admin')
        await sleep(200)

        await elementClick(page, 'form button[type="submit"]')
        await page.waitForNetworkIdle()
    }

    await sleep(lookAroundDelay)
    console.log('navigate to new app')
    await elementClick(page, 'main button')
    await page.waitForNetworkIdle()

    await sleep(lookAroundDelay)
    console.log('create new app')
    await typing(page, '#app_id', 'demo')

    await sleep(lookAroundDelay)
    await elementClick(page, '#preset')
    await sleep(200)
    await page.select('#preset', 'nuxt')

    await sleep(lookAroundDelay)
    elementScrollIntoView(page, 'button[type="submit"]')

    await sleep(lookAroundDelay)
    await elementClick(page, 'button[type="submit"]')

    // console.log('navigate to builds')
    // await elementClick(page, 'nav > :nth-child(4)')
    // await page.waitForNetworkIdle()
    // await sleep(200)

    // console.log('navigate to new build')
    // await elementClick(page, 'main button')
    // await page.waitForNetworkIdle()
    // await sleep(200)

    // console.log('build name')
    // await typing(page, '#build_name', 'first build')

    // console.log('build select archive')
    // await elementClick(page, 'input[type="file"]')

    await sleep(2000)

    await recorder.stop()
    await browser.close()
}

main()
    .then(() => {
        console.log('Done')
        process.exit()
    })
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
