// Бесконечный шум, посчитанный на ходу, отсчёт за отсчётом.
//
// Дорожек у экрана «Звук» нет нарочно. Запись, которой хватит на ночь, — это
// десятки мегабайт в приложении, а короткая запись слышна как петля: ухо находит
// стык и перестаёт отпускать. Здесь шум не кончается и не повторяется, потому что
// каждый отсчёт берётся из случайного числа, и сжатия нет вовсе — считается он
// уже после всех кодеков, прямо перед звуковой картой.
//
// Три цвета шума. Белый — равная мощность на все частоты, из него делается собственно
// белый шум. Розовый падает на 3 дБ на октаву, он мягче и годится в основу дождя.
// Коричневый падает на 6 дБ, в нём почти один низ — из него выходит прибой.
//
// Каналы считаются по отдельности: два независимых шума дают широкую картину,
// а один и тот же в оба уха звучит точкой между глаз и к утру надоедает.

const PINK_COEFF = [0.99886, 0.99332, 0.969, 0.8665, 0.55, -0.7616]
const PINK_GAIN = [0.0555179, 0.0750759, 0.153852, 0.3104856, 0.5329522, -0.016898]

function freshState() {
  return { pink: [0, 0, 0, 0, 0, 0], extra: 0, brown: 0 }
}

function nextSample(kind, s) {
  const white = Math.random() * 2 - 1
  if (kind === 'white') return white

  if (kind === 'pink') {
    let sum = 0
    for (let i = 0; i < 6; i += 1) {
      s.pink[i] = PINK_COEFF[i] * s.pink[i] + white * PINK_GAIN[i]
      sum += s.pink[i]
    }
    const out = (sum + s.extra + white * 0.5362) * 0.11
    s.extra = white * 0.115926
    return out
  }

  // Коричневый: белый шум, пропущенный через текущую утечку. Деление на 1.02
  // держит уровень на месте — без него он уползает в бесконечность.
  s.brown = (s.brown + 0.02 * white) / 1.02
  return s.brown * 3.5
}

class NoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    const given = options && options.processorOptions ? options.processorOptions.kind : null
    this.kind = given === 'pink' || given === 'brown' ? given : 'white'
    this.channels = [freshState(), freshState()]
    this.port.onmessage = (event) => {
      if (event.data === 'stop') this.done = true
    }
    this.done = false
  }

  process(_inputs, outputs) {
    const out = outputs[0]
    for (let ch = 0; ch < out.length; ch += 1) {
      const data = out[ch]
      // Каналов в выходе может быть больше, чем состояний: лишние берут чужое,
      // лишь бы не читать из пустоты.
      const state = this.channels[ch % this.channels.length]
      for (let i = 0; i < data.length; i += 1) data[i] = nextSample(this.kind, state)
    }
    // false освободил бы узел, и шум бы кончился: держимся, пока не попросят уйти.
    return !this.done
  }
}

registerProcessor('noise', NoiseProcessor)
