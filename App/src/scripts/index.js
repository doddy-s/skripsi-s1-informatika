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

/**
 * Blocks a tweet based on its text content.
 *
 * @param {HTMLElement} tweetTextElement - The tweet text element to process.
 */
async function blockTweet(tweetTextElement) {
  const $tweetText = $(tweetTextElement)

  if (await classify(tweetTextElement.textContent)) {
    $tweetText.addClass('hidden')

    $tweetText.parent().append(TWEET_HIDER)

    onTweetBlocked()
  }
}

/**
 *
 * @param {HTMLElement} tweetTextElement
 */
function onTweetTextLoaded(tweetTextElement) {
  const $tweet = $(tweetTextElement)
  if ($tweet.attr('project-s') === 'labeled') {
    return
  }

  $tweet.attr('project-s', 'labeled')

  blockTweet(tweetTextElement)
}

/**
 * @param {Node} node
 */
function onNodeAdded(node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (
      node.hasAttribute('data-testid') &&
      node.getAttribute('data-testid') === 'cellInnerDiv'
    ) {
      $(node)
        .find('div[data-testid="tweetText"]')
        .each((_, tweetTextNode) => {
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
    return data
  } catch (error) {
    console.error('Error fetching the JSON file:', error)
  }
}

async function fetchModel(url) {
  return await tf.loadLayersModel(url)
}

function main() {
  fetchJson(
    'https://raw.githubusercontent.com/doddy-s/skripsi-s1-informatika/refs/heads/main/Datasets/processed/metadata.json'
  ).then((metadata) => {
    METADATA = metadata

    console.log('METADATA', METADATA)

    fetchJson(
      'https://raw.githubusercontent.com/doddy-s/skripsi-s1-informatika/refs/heads/main/Datasets/processed/indonesian-hate-speech-processed-word-index.json'
    ).then((word_index) => {
      WORD_INDEX = word_index

      fetchModel(
        'https://raw.githubusercontent.com/doddy-s/akunin-model/refs/heads/main/indonesian-hate-speech-binary-classification-12k/model.json'
      ).then((model) => {
        MODEL = model

        console.log('MODEL', MODEL)

        startMutationObserver()
      })
    })
  })
}

jQuery(main)
