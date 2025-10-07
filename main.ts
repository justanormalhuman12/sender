radio.setGroup(7)

// CONFIG
const LOOP_MS = 25
const RADIO_GROUP = 7
const MAX_RAW = 1000
const MAX_SPEED = 255
const DEADZONE = 30
const TURN_BASE = 250
const CALIBRATE_HOLD_MS = 1200
const SMOOTH_FACTOR = 4  // subtle smoothing

// STATE
let neutralY = input.acceleration(Dimension.Y)
let prevLeft = 0
let prevRight = 0
let seq = 0

let aWasDown = false
let bWasDown = false
let aDownStart = 0
let bDownStart = 0
let abCalibratedFlag = false

radio.setGroup(RADIO_GROUP)

function clamp(v: number, lo: number, hi: number): number {
    if (v < lo) return lo
    if (v > hi) return hi
    return v
}

basic.forever(function () {
    let now = input.runningTime()
    let a = input.buttonIsPressed(Button.A)
    let b = input.buttonIsPressed(Button.B)

    // A+B long press -> calibrate neutral
    if (a && b) {
        if (!(aWasDown && bWasDown)) {
            aDownStart = now
            bDownStart = now
            abCalibratedFlag = false
        } else if (!abCalibratedFlag && now - aDownStart >= CALIBRATE_HOLD_MS) {
            neutralY = input.acceleration(Dimension.Y)
            abCalibratedFlag = true
        }
    }

    aWasDown = a
    bWasDown = b

    // read tilt
    let rawY = input.acceleration(Dimension.Y) - neutralY
    let forwardRaw = -rawY

    // compute base speed
    let baseSpeed = 0
    let absRaw = Math.abs(forwardRaw)
    if (absRaw > DEADZONE) {
        let mag = (absRaw - DEADZONE) / (MAX_RAW - DEADZONE)
        if (mag > 1) mag = 1
        baseSpeed = Math.trunc(mag * MAX_SPEED)
        if (forwardRaw > 0) baseSpeed = -baseSpeed
    }

    // steering with buttons
    let leftTarget = baseSpeed
    let rightTarget = baseSpeed

    if (a && b) {
        leftTarget = 0
        rightTarget = 0
    } else if (a || b) {
        let turnSign = a ? -1 : 1
        let turnEffect = TURN_BASE
        if (baseSpeed != 0) {
            leftTarget = baseSpeed - turnSign * turnEffect
            rightTarget = baseSpeed + turnSign * turnEffect
        } else {
            leftTarget = -turnSign * turnEffect
            rightTarget = turnSign * turnEffect
        }
    }

    // subtle smoothing to prevent jerk
    leftTarget = Math.idiv(prevLeft * (SMOOTH_FACTOR - 1) + leftTarget, SMOOTH_FACTOR)
    rightTarget = Math.idiv(prevRight * (SMOOTH_FACTOR - 1) + rightTarget, SMOOTH_FACTOR)

    prevLeft = leftTarget
    prevRight = rightTarget

    // send CSV: seq,left,right
    seq = (seq + 1) & 65535
    radio.sendString("" + seq + "," + leftTarget + "," + rightTarget)

    basic.pause(LOOP_MS)
})
