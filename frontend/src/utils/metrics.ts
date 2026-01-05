export const parseCpu = (cpuStr: string): number => {
    if (!cpuStr) return 0
    if (typeof cpuStr === 'number') return cpuStr
    const value = parseFloat(cpuStr)
    if (cpuStr.endsWith('n')) return value / 1000000
    if (cpuStr.endsWith('u')) return value / 1000
    if (cpuStr.endsWith('m')) return value
    return value * 1000
}

export const parseMem = (memStr: string): number => {
    if (!memStr || memStr === '0') return 0
    if (typeof memStr === 'number') return memStr

    const value = parseFloat(memStr)
    const unit = memStr.match(/[a-zA-Z]+/)?.[0] || ''

    switch (unit) {
        case 'Ki': return value
        case 'Mi': return value * 1024
        case 'Gi': return value * 1024 * 1024
        case 'Ti': return value * 1024 * 1024 * 1024
        case 'k': return value * 1000 / 1024
        case 'M': return value * 1000000 / 1024
        case 'G': return value * 1000000000 / 1024
        case 'T': return value * 1000000000000 / 1024
        default: return value / 1024 // Assume bytes if no unit
    }
}
