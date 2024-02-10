export async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function easeInOut(pos, len, base: number) {
    return (base + (1 - Math.sin((pos / len) * Math.PI)) * base)
}

export async function easeInOutSleep(acc, pos, len, speed: number) {
    const delayStep = easeInOut(pos, len, speed)
    acc += delayStep
    if(acc >= 1) {
        const roundedDelay = Math.floor(acc)
        await sleep(roundedDelay)
        acc -= roundedDelay
    }
    return acc
}
