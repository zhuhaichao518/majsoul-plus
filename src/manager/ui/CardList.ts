import { ipcRenderer, remote } from 'electron'
import i18n from '../../i18n'
import { Card } from './Card'
import { CheckedboxCard } from './CheckedboxCard'

const dialog = remote.dialog

interface CardListItem extends MajsoulPlus_Manager.CardMetadataWithEnable {
  id: string
  card: Card | CheckedboxCard
}

export class CardList {
  name: string
  cardListItemMap: Map<string, CardListItem> = new Map()

  constructor() {
    this.name = this.constructor.name
  }

  protected getCardDetails = (): MajsoulPlus_Manager.GetDetailMetadataResponse => {
    const details = ipcRenderer.sendSync(
      `get-${this.name.toLowerCase()}-details`
    )
    console.log(this.name, details)
    return details
  }

  protected generateCardsFromDetails = (
    details: MajsoulPlus_Manager.GetDetailMetadataResponse
  ) => {
    for (const id of Object.keys(details)) {
      details[id].metadata.type = this.name
      this.generateCardFromMetadata(details[id])
    }
  }

  protected renderCards = () => {
    const target = document.querySelector(`#${this.name}Infos`)
    target.innerHTML = ''
    this.cardListItemMap.forEach(({ card }) => {
      const { DOM } = card
      target.appendChild(DOM)
    })
  }

  protected generateCardFromMetadata = (
    info: MajsoulPlus_Manager.CardMetadataWithEnable
  ) => {
    const card = new CheckedboxCard(info.metadata, info.enabled)
    const id = info.metadata.id
    this.cardListItemMap.set(id, { ...info, id, card })

    card.on('change', () => this.handleCheckedChange(id))
    card.on('export', () => this.handleExport(id))
    card.on('remove', () => this.handleRemove(id))
  }

  protected handleCheckedChange = (id: string) => {
    const cardItem = this.cardListItemMap.get(id)
    if (cardItem.card['checked']) {
      this.cardListItemMap.get(id).enabled = cardItem['checked']
    }
  }

  protected handleExport(id: string) {
    const { extend, typeText } = this.getExportInfo()

    // 向主进程请求打包
    const fileName = ipcRenderer.sendSync(`zip-${this.name.toLowerCase()}`, id)

    const pathToSave = dialog.showSaveDialog({
      title: i18n.text.manager.exportTo(),
      filters: [
        {
          name: typeText,
          extensions: [extend]
        }
      ],
      defaultPath: fileName
    })

    if (pathToSave) {
      // TODO: 通知主进程复制
      const err = ipcRenderer.sendSync('copy-todo')
      if (err) {
        alert(i18n.text.manager.exportExtendResourcesFailed(err))
      } else {
        alert(i18n.text.manager.exportExtendResourcesSucceeded())
      }
    }
  }

  protected handleRemove = (id: string) => {
    const cardItem = this.cardListItemMap.get(id)
    cardItem.card.DOM.remove()
    ipcRenderer.sendSync(`remove-${this.name.toLowerCase()}`, id)
    this.renderCards()
  }

  protected getExportInfo(): MajsoulPlus_Manager.ExportInfo {
    return undefined
  }

  load() {
    this.generateCardsFromDetails(this.getCardDetails())
    this.renderCards()
  }

  save() {
    // TODO: 通知主进程保存
  }

  changeEditable() {
    this.cardListItemMap.forEach(cardItem => {
      cardItem.card.setEditable(!cardItem.card.isEditable)
    })
  }
}
