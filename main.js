import WebShot from './dist/index.js'

const screenWidth = 1280
const screenHeight = 800

const output_path = 'screen.mp4'
const screenRecorderConfig = {
    followNewTab: false,
    fps: 60,
    videoCrf: 18,
    videoCodec: 'libx264',
    videoPreset: 'ultrafast',
    autopad: {
        color: 'black',
    },
    aspectRatio: '' + screenWidth + ':' + screenHeight,
}

async function main() {
    console.log('start')

    const w = new WebShot()
    await w.start(screenWidth, screenHeight, 4)

    const lookAroundDelay = 1000

    await w.goto('http://d1.cesbo.net')
    await w.screencast(output_path, screenRecorderConfig)

    // Login if needed
    if(await w.elementExists('#password')) {
        console.log('log in as admin')
        await w.sleep(lookAroundDelay)

        await w.textType('#name', 'admin')
        await w.textType('#password', 'admin')

        await w.sleep(lookAroundDelay)
        await w.elementClick('form button[type=submit]')
    }

    // APP

    console.log('navigate to new app')
    await w.sleep(lookAroundDelay)
    await w.elementClick('main button')

    console.log('create new app')
    await w.sleep(lookAroundDelay)
    await w.textType('#app_id', 'demo')

    console.log('select preset')
    await w.sleep(lookAroundDelay)
    await w.elementSelect('#preset', 'nuxt')

    console.log('submit new app')
    await w.sleep(lookAroundDelay)
    await w.elementScrollIntoView('button[type=submit]')
    await w.sleep(lookAroundDelay)
    await w.elementClick('button[type=submit]')

    // BUILD

    console.log('navigate to builds')
    await w.sleep(lookAroundDelay)
    await w.elementClick('nav > :nth-child(5)')

    console.log('navigate to new build')
    await w.sleep(lookAroundDelay)
    await w.elementClick('main button')

    console.log('build name')
    await w.sleep(lookAroundDelay)
    await w.textType('#build_name', 'first build')

    console.log('build select archive')
    await w.sleep(lookAroundDelay)
    await w.elementFileSelect('input[type=file]', '/Users/and/Downloads/nuxt-demo.tar.gz')

    console.log('submit new build')
    await w.sleep(lookAroundDelay)
    await w.elementScrollIntoView('button[type=submit]')
    await w.sleep(lookAroundDelay)
    await w.elementClick('button[type=submit]')

    await w.elementWaitFor('main ul>li svg.text-success', 120_000)
    await w.sleep(lookAroundDelay)

    // INSTANCE

    console.log('navigate to instances')
    await w.sleep(lookAroundDelay)
    await w.elementClick('nav > :nth-child(4)')

    console.log('navigate to new instance')
    await w.sleep(lookAroundDelay)
    await w.elementClick('main button')

    console.log('instance name')
    await w.sleep(lookAroundDelay)
    await w.textType('#instance_name', 'main')

    console.log('instance port')
    await w.sleep(lookAroundDelay)
    await w.textType('#port', '3000')

    console.log('submit new instance')
    await w.sleep(lookAroundDelay)
    await w.elementScrollIntoView('button[type=submit]')
    await w.sleep(lookAroundDelay)
    await w.elementClick('button[type=submit]')

    await w.elementWaitFor('main ul>li svg.text-success')
    await w.sleep(lookAroundDelay)

    const instance_id = (await w.elementGetAttribute('main ul>li>div', 'id'))?.slice(9)
    if(!instance_id) {
        throw new Error('instance id not found')
    }
    console.log('instance id:', instance_id)

    // DOMAIN

    console.log('navigate to domains')
    await w.sleep(lookAroundDelay)
    await w.elementClick('nav > :nth-child(3)')

    console.log('navigate to new domain')
    await w.sleep(lookAroundDelay)
    await w.elementClick('main button')

    console.log('domain name')
    await w.sleep(lookAroundDelay)
    await w.textType('#domain_name', 'demo.citrus.run')

    console.log('select instance')
    await w.sleep(lookAroundDelay)
    await w.elementSelect('#domain_instance', instance_id)

    console.log('select access method')
    await w.sleep(lookAroundDelay)
    await w.elementSelect('#access', 'cloudflare')
    await w.wait() // wait for the API request to finish

    console.log('submit new domain')
    await w.sleep(lookAroundDelay)
    await w.elementScrollIntoView('button[type=submit]')
    await w.sleep(lookAroundDelay)
    await w.elementClick('button[type=submit]')

    // await page.waitForSelector('main ul>li svg.text-success')
    // await sleep(lookAroundDelay)

    // DONE

    await w.sleep(2000)
    await w.stop()
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
