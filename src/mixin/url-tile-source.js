import { createTileUrlFunctionFromTemplates } from 'ol-tilecache'
import { expandUrl } from 'ol/tileurlfunction'
import { obsFromOlEvent } from '../rx-ext'
import { and, isEmpty, isEqual, isFunction, isString, negate, pick, replaceTokens } from '../util/minilo'
import tileSource from './tile-source'

const isNotEmptyString = and(isString, negate(isEmpty))

export default {
  mixins: [
    tileSource,
  ],
  props: {
    // ol/source/UrlTile
    /**
     * @type {function|undefined}
     */
    tileLoadFunction: Function,
    /**
     * @type {function|undefined}
     */
    tileUrlFunction: Function,
    /**
     * @type {string|undefined}
     */
    url: {
      type: String,
      validator: isNotEmptyString,
    },
    /**
     * @type {string[]|undefined}
     */
    urls: {
      type: Array,
      validator: value => value.every(isNotEmptyString),
    },
  },
  computed: {
    urlTokens () {
      return []
    },
    parsedUrl () {
      if (!this.url) return []

      return replaceTokens(this.url, pick(this, this.urlTokens))
    },
    parsedUrls () {
      const urls = []

      if (this.url) {
        urls.push(this.url)
      }
      if (this.urls && this.urls.length > 0) {
        urls.push(...this.urls)
      }

      const tokens = pick(this, this.urlTokens)

      return urls.map(url => replaceTokens(url, tokens))
    },
    expandedUrls () {
      return this.parsedUrls.reduce((urls, url) => urls.concat(...expandUrl(url)), [])
    },
    urlFunc () {
      if (isFunction(this.tileUrlFunction)) {
        return this.tileUrlFunction
      }

      return createTileUrlFunctionFromTemplates(this.expandedUrls, this.tileGrid)
    },
  },
  watch: {
    async tileLoadFunction (value) {
      await this.setTileLoadFunction(value)
    },
    async urlFunc (value) {
      await this.setTileUrlFunction(value)
    },
  },
  methods: {
    /**
     * @returns {Promise<module:ol/Tile.LoadFunction>}
     */
    async getTileLoadFunction () {
      return (await this.resolveSource()).getTileLoadFunction()
    },
    /**
     * @param {module:ol/Tile.LoadFunction} tileLoadFunction
     * @returns {Promise<void>}
     */
    async setTileLoadFunction (tileLoadFunction) {
      const source = await this.resolveSource()

      if (tileLoadFunction === source.getTileLoadFunction()) return

      source.setTileLoadFunction(tileLoadFunction)
    },
    /**
     * @returns {Promise<module:ol/Tile.UrlFunction>}
     */
    async getTileUrlFunction () {
      return (await this.resolveSource()).getTileUrlFunction()
    },
    /**
     * @param {module:ol/Tile.UrlFunction} tileUrlFunction
     * @param {number} [tileKey]
     * @returns {Promise<void>}
     */
    async setTileUrlFunction (tileUrlFunction, tileKey) {
      const source = await this.resolveSource()

      if (tileUrlFunction === source.getTileUrlFunction()) return

      source.setTileUrlFunction(tileUrlFunction, tileKey)
    },
    /**
     * @returns {Promise<string[]|undefined>}
     */
    async getUrls () {
      return (await this.resolveSource()).getUrls()
    },
    /**
     * @param {string[]} urls
     * @returns {Promise<void>}
     */
    async setUrls (urls) {
      const source = await this.resolveSource()

      if (isEqual(urls, source.getUrls())) return

      source.setUrls(urls)
    },
    /**
     * @param {string} url
     * @returns {Promise<void>}
     */
    async setUrl (url) {
      return this.setUrls(expandUrl(url))
    },
    /**
     * @returns {Promise<void>}
     */
    async subscribeAll () {
      await Promise.all([
        this::tileSource.methods.subscribeAll(),
        this::subscribeToSourceEvents(),
      ])
    },
    ...pick(tileSource.methods, [
      'init',
      'deinit',
      'mount',
      'unmount',
      'refresh',
      'scheduleRefresh',
      'remount',
      'scheduleRemount',
      'recreate',
      'scheduleRecreate',
      'getServices',
      'resolveSource',
      'resolveOlObject',
    ]),
  },
}

async function subscribeToSourceEvents () {
  const source = await this.resolveSource()

  const events = obsFromOlEvent(source, [
    'tileloadstart',
    'tileloadend',
    'tileloaderror',
  ])

  this.subscribeTo(events, evt => {
    ++this.rev

    this.$emit(evt.type, evt)
  })
}
