// Server-side example: generate a video with Seedance 2.5 through the Higgsfield API.
// Run with `npm run generate`. Credentials come from HF_CREDENTIALS
// ("key-id:key-secret") in .env.local or the process environment, never from code.

import { config as loadEnv } from 'dotenv'
import {
  APIError,
  AuthenticationError,
  BadInputError,
  CredentialsMissedError,
  NotEnoughCreditsError,
  TimeoutError,
  ValidationError,
  createHiggsfieldClient,
} from '@higgsfield/client/v2'

loadEnv({ path: '.env.local', quiet: true })

const MODEL = 'bytedance/seedance-2.5/text-to-video'

async function main(): Promise<number> {
  if (!process.env.HF_CREDENTIALS) {
    console.error('HF_CREDENTIALS is not set. Add it to .env.local as HF_CREDENTIALS=key-id:key-secret')
    return 1
  }

  // The SDK reads HF_CREDENTIALS from the environment itself, so the value never passes through this file.
  const client = createHiggsfieldClient({
    pollInterval: 5_000,
    // Video renders take minutes; the SDK default of 5 minutes is too short.
    maxPollTime: 20 * 60_000,
  })

  console.log(`Submitting ${MODEL} request and waiting for it to finish…`)
  const response = await client.subscribe(MODEL, {
    input: {
      prompt: 'A cinematic scene at sunset',
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
    },
    withPolling: true,
  })

  // `canceled` is not in the SDK's V2RequestStatus type but the API can return it.
  const status: string = response.status
  switch (status) {
    case 'completed': {
      const url = response.video?.url
      if (!url) {
        console.error(`Request ${response.request_id} completed but returned no video URL.`)
        return 1
      }
      console.log(`Video URL: ${url}`)
      return 0
    }
    case 'nsfw':
      console.error(`Request ${response.request_id} was rejected by content moderation (credits are refunded).`)
      return 1
    case 'failed':
      console.error(`Request ${response.request_id} failed (credits are refunded).`)
      return 1
    case 'canceled':
      console.error(`Request ${response.request_id} was canceled.`)
      return 1
    default:
      console.error(`Request ${response.request_id} ended with unexpected status "${status}".`)
      return 1
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    // Messages from these SDK errors describe the failure; none of them include the credential values.
    if (error instanceof CredentialsMissedError || error instanceof AuthenticationError) {
      console.error('Authentication failed. Check HF_CREDENTIALS in .env.local (format key-id:key-secret).')
    } else if (error instanceof NotEnoughCreditsError) {
      // The SDK maps every HTTP 403 to this error, including a proxy or firewall refusing the connection.
      console.error('Got HTTP 403: either not enough Higgsfield credits, or a network proxy blocked api.higgsfield.ai.')
    } else if (error instanceof BadInputError || error instanceof ValidationError) {
      console.error(`The API rejected the input: ${error.message}`)
    } else if (error instanceof TimeoutError) {
      console.error(`Stopped waiting: ${error.message}. The request may still finish (or have been canceled) on Higgsfield.`)
    } else if (error instanceof APIError) {
      console.error(`Higgsfield API error ${error.statusCode}: ${error.message}`)
    } else {
      console.error('Request failed:', error instanceof Error ? error.message : error)
    }
    process.exit(1)
  })
