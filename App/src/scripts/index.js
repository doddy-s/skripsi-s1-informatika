const TWEET_HIDER = `<div class="open-sans flex h-24 w-90 items-center justify-between rounded-lg border-2 border-blue bg-blue px-4 py-2 my-4 mx-2" project-s="tweetHider">
<p>Konten ini mungkin mengandung hate-speech, kata-kata kasar, atau tindakan cyberbullying. Klik "Show" untuk melihatnya.</p>
<button class="px-4 py-2" project-s="showTweet">Show</button>
</div>`

let LANGUAGES_TO_CHECK = []

let WORD_INDEX = {}

let METADATA = {}

let MODEL = {}

function predictLabel(tokenizedText) {
  const prediction = MODEL.predict(tf.tensor([tokenizedText])).dataSync()[0]
  console.log(prediction, text)
  const label = prediction >= 0.5 ? true : false
  return label
}

function tokenize() {
  let tokenized = []
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean)
  for (let i = 0; i < METADATA?.meta?.dataset?.longest_text || 45; i++) {
    tokenized[i] = indonesianWordIndex[tokens[i]] || 0
  }

  return tokenized
}

async function classify(text) {
  const lang = await chrome.i18n.detectLanguage(text)

  if (
    !(METADATA?.languages || ['id', 'ms']).includes(
      lang?.languages?.[0]?.language
    )
  ) {
    return false
  }

  try {
    return predictLabel(tokenize(preprocess(text)))
  } catch {
    return false
  }
}

function showTweetButtonHandler(e) {
  const tweetText = $(e.target.parentNode.parentNode).children()
  $(tweetText[0]).removeClass('hidden')
  const tweetHider =
    $(tweetText[1]).attr('project-s') === 'tweetHider'
      ? $(tweetText[1])
      : $(tweetText[2])
  tweetHider.removeClass('flex').addClass('hidden')
}

async function onTweetBlocked() {
  try {
    document.body
      .querySelectorAll('[project-s="showTweet"]')
      .forEach((item) => {
        if (
          item.hasAttribute('project-s-show-tweet-button') &&
          item.getAttribute('project-s-show-tweet-button') ===
            'handlerConnected'
        ) {
          return
        }

        item.setAttribute('project-s-show-tweet-button', 'handlerConnected')
        item.addEventListener('click', showTweetButtonHandler)
      })
  } catch {}
}

async function blockTweet(tweetTextElement) {
  if (await classify(tweetTextElement.textContent)) {
    tweetTextElement.classList.add('hidden')

    tweetTextElement.parentElement.appendChild(TWEET_HIDER)

    onTweetBlocked()
  }
}

function onTweetTextLoaded(tweetTextElement) {
  if (tweetTextElement.getAttribute('project-s') === 'labeled') {
    return
  }

  tweetTextElement.setAttribute('project-s', 'labeled')

  blockTweet(tweetTextElement)
}

function onNodeAdded(node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (
      node.hasAttribute('data-testid') &&
      node.getAttribute('data-testid') === 'cellInnerDiv'
    ) {
      const tweetTextNodes = node.querySelectorAll(
        'div[data-testid="tweetText"]'
      )
      tweetTextNodes.forEach((tweetTextNode) => {
        onTweetTextLoaded(tweetTextNode)
      })
    }
  }
}

function startMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        mutation.addedNodes.forEach((addedNode) => {
          onNodeAdded(addedNode)
        })
      }
    })
  })

  const observee = document.body

  if (observee) {
    observer.observe(observee, {
      childList: true,
      subtree: true,
    })
    console.log('Now observing ...')
  }
}

async function fetchJson(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Error during fetching Json: ${response.status}`)
    }
    const data = await response.json()

    if (!data) {
      throw new Error('Data fetched is empty, url: ' + url)
    }
    return data
  } catch (error) {
    console.error('fetchJson function error:', error)
  }
}

async function fetchModel(url) {
  return await tf.loadLayersModel(url)
}

async function main() {
  try {
    METADATA = await fetchJson(
      'https://raw.githubusercontent.com/doddy-s/skripsi-s1-informatika/refs/heads/main/Datasets/processed/metadata.json'
    )
    console.log('METADATA', METADATA)

    WORD_INDEX = await fetchJson(
      'https://raw.githubusercontent.com/doddy-s/skripsi-s1-informatika/refs/heads/main/Datasets/processed/indonesian-hate-speech-processed-word-index.json'
    )
    console.log(
      'WORD_INDEX',
      Object.fromEntries(Object.entries(WORD_INDEX).slice(0, 10))
    )

    MODEL = await fetchModel(
      'https://raw.githubusercontent.com/doddy-s/akunin-model/refs/heads/main/indonesian-hate-speech-binary-classification-12k/model.json'
    )
    console.log('MODEL', MODEL)

    startMutationObserver()
  } catch (error) {
    console.error('main function error:', error)
    throw new Error(error.message)
  }
}

main().catch(() => {
  console.info('HateX failed to start. Exiting...')
  process.exit(1)
})
