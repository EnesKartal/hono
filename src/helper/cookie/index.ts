/**
 * @module
 * Cookie Helper for Hono.
 */

import type { Context } from '../../context'
import { parse, parseSigned, serialize, serializeSigned } from '../../utils/cookie'
import type { Cookie, CookieOptions, CookiePrefixOptions, SignedCookie } from '../../utils/cookie'

interface GetCookie {
  (c: Context, key: string): string | undefined
  (c: Context): Cookie
  (c: Context, key: string, prefixOptions?: CookiePrefixOptions): string | undefined
}

interface GetSignedCookie {
  (c: Context, secret: string | BufferSource, key: string): Promise<string | undefined | false>
  (c: Context, secret: string | BufferSource): Promise<SignedCookie>
  (
    c: Context,
    secret: string | BufferSource,
    key: string,
    prefixOptions?: CookiePrefixOptions
  ): Promise<string | undefined | false>
}

const getPrefixedCookieName = (key: string, prefix?: CookiePrefixOptions): string => {
  switch (prefix) {
    case 'secure':
      return '__Secure-' + key
    case 'host':
      return '__Host-' + key
    case 'http':
      return '__Http-' + key
    case 'host-http':
      return '__Host-Http-' + key
    default:
      return key
  }
}

const resolvePrefixedCookie = (
  name: string,
  opt?: CookieOptions
): [string, CookieOptions] => {
  const finalName = getPrefixedCookieName(name, opt?.prefix)
  switch (opt?.prefix) {
    case 'secure':
      return [finalName, { path: '/', ...opt, secure: true }]
    case 'host':
      return [finalName, { ...opt, path: '/', secure: true, domain: undefined }]
    case 'http':
      return [finalName, { path: '/', ...opt, secure: true, httpOnly: true }]
    case 'host-http':
      return [finalName, { ...opt, path: '/', secure: true, httpOnly: true, domain: undefined }]
    default:
      return [finalName, { path: '/', ...opt }]
  }
}

export const getCookie: GetCookie = (c, key?, prefix?: CookiePrefixOptions) => {
  const cookie = c.req.raw.headers.get('Cookie')
  if (typeof key === 'string') {
    if (!cookie) {
      return undefined
    }
    const finalKey = getPrefixedCookieName(key, prefix)
    const obj = parse(cookie, finalKey)
    return obj[finalKey]
  }
  if (!cookie) {
    return {}
  }
  const obj = parse(cookie)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return obj as any
}

export const getSignedCookie: GetSignedCookie = async (
  c,
  secret,
  key?,
  prefix?: CookiePrefixOptions
) => {
  const cookie = c.req.raw.headers.get('Cookie')
  if (typeof key === 'string') {
    if (!cookie) {
      return undefined
    }
    const finalKey = getPrefixedCookieName(key, prefix)
    const obj = await parseSigned(cookie, secret, finalKey)
    return obj[finalKey]
  }
  if (!cookie) {
    return {}
  }
  const obj = await parseSigned(cookie, secret)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return obj as any
}

export const generateCookie = (name: string, value: string, opt?: CookieOptions): string => {
  // Cookie names prefixed with __Secure- can be used only if they are set with the secure attribute.
  // Cookie names prefixed with __Host- can be used only if they are set with the secure attribute, must have a path of / (meaning any path at the host)
  // and must not have a Domain attribute.
  // Cookie names prefixed with __Http- must have Secure and HttpOnly attributes.
  // Cookie names prefixed with __Host-Http- must satisfy __Host- rules and have the HttpOnly attribute.
  // Read more at https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#cookie_prefixes'
  const [finalName, finalOpt] = resolvePrefixedCookie(name, opt)
  return serialize(finalName, value, finalOpt)
}

export const setCookie = (c: Context, name: string, value: string, opt?: CookieOptions): void => {
  const cookie = generateCookie(name, value, opt)
  c.header('Set-Cookie', cookie, { append: true })
}

export const generateSignedCookie = async (
  name: string,
  value: string,
  secret: string | BufferSource,
  opt?: CookieOptions
): Promise<string> => {
  const [finalName, finalOpt] = resolvePrefixedCookie(name, opt)
  return await serializeSigned(finalName, value, secret, finalOpt)
}

export const setSignedCookie = async (
  c: Context,
  name: string,
  value: string,
  secret: string | BufferSource,
  opt?: CookieOptions
): Promise<void> => {
  const cookie = await generateSignedCookie(name, value, secret, opt)
  c.header('set-cookie', cookie, { append: true })
}

export const deleteCookie = (c: Context, name: string, opt?: CookieOptions): string | undefined => {
  const deletedCookie = getCookie(c, name, opt?.prefix)
  setCookie(c, name, '', { ...opt, maxAge: 0 })
  return deletedCookie
}
