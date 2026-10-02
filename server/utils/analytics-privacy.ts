import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { open } from 'maxmind'
import type { H3Event } from 'h3'
import type { AnalyticsGeoLocation } from '#shared/types/analytics'

const UNKNOWN_LOCATION: AnalyticsGeoLocation = { countryCode: 'unknown', regionName: 'unknown', cityName: 'unknown' }
let warnedMissingSalt = false
let readerPath = ''
type GeoReader = Awaited<ReturnType<typeof open>>
interface GeoLocationLookup {
  country?: { iso_code?: string }
  subdivisions?: Array<{ names?: { en?: string } }>
  city?: { names?: { en?: string } }
}

let readerPromise: Promise<GeoReader | null> | null = null

export function getTrustedClientIp(event: H3Event): string | null {
  const realIp = getHeader(event, 'x-real-ip')
  const forwarded = getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
  const ip = realIp || forwarded
  return ip && isIP(ip) ? ip : null
}

export function hashAnalyticsIp(ip: string | null, salt: string): string | null {
  if (!ip || !salt) return null
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export async function resolveAnalyticsLocation(ip: string | null, databasePath: string): Promise<AnalyticsGeoLocation> {
  if (!ip || !databasePath) return UNKNOWN_LOCATION
  try {
    const reader = await getReader(databasePath)
    const response = reader?.get(ip) as GeoLocationLookup | null | undefined
    if (!response) return UNKNOWN_LOCATION
    return {
      countryCode: response.country?.iso_code || 'unknown',
      regionName: response.subdivisions?.[0]?.names?.en || 'unknown',
      cityName: response.city?.names?.en || 'unknown',
    }
  }
  catch {
    return UNKNOWN_LOCATION
  }
}

export function getAnalyticsIdentity(event: H3Event, salt: string): { ipHash: string | null, ip: string | null } {
  const ip = getTrustedClientIp(event)
  if (ip && !salt && !warnedMissingSalt) {
    warnedMissingSalt = true
    console.warn('[analytics] NUXT_ANALYTICS_IP_HASH_SALT 未配置，IP 哈希采集已禁用。')
  }
  return { ip, ipHash: hashAnalyticsIp(ip, salt) }
}

async function getReader(path: string): Promise<GeoReader | null> {
  if (readerPromise && readerPath === path) return readerPromise
  readerPath = path
  readerPromise = open(path).catch(() => null)
  return readerPromise
}
