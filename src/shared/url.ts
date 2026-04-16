type SanitizeUrlOptions = {
  allowedHosts?: string[]
}

function matchesAllowedHost(hostname: string, allowedHosts: string[]) {
  return allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`))
}

export function sanitizeExternalUrl(rawUrl: string, options: SanitizeUrlOptions = {}) {
  const normalized = rawUrl.trim()

  if (!normalized) {
    return ''
  }

  const candidate = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`

  try {
    const parsedUrl = new URL(candidate)

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return ''
    }

    if (!parsedUrl.hostname) {
      return ''
    }

    if (options.allowedHosts?.length && !matchesAllowedHost(parsedUrl.hostname, options.allowedHosts)) {
      return ''
    }

    return parsedUrl.toString()
  } catch {
    return ''
  }
}
