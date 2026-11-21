// 区块链哈希工具：使用浏览器 WebCrypto 在本地重算 SHA-256，
// 实现与后端 Blockchain.js 完全一致的校验逻辑（index + previousHash + timestamp + data + nonce）

const encoder = new TextEncoder()

/** 计算字符串的 SHA-256 十六进制摘要 */
export async function sha256Hex(input) {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(String(input)))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 与后端 calculateHash 相同的拼接规则 */
export function blockHashSource(block) {
  return `${block.index}${block.previousHash}${block.timestamp}${block.data}${block.nonce}`
}

/** 重算一个区块的哈希 */
export function recomputeBlockHash(block) {
  return sha256Hex(blockHashSource(block))
}

/** 验证哈希是否满足难度要求（前缀为 difficulty 个 0） */
export function isValidHashDifficulty(hash, difficulty = 3) {
  return String(hash || '').startsWith('0'.repeat(difficulty))
}

/** 后端 Block.genesis 的创世区块 */
export const GENESIS_BLOCK = {
  index: 0,
  previousHash: '0',
  timestamp: 1508270000000,
  data: 'Genesis Block',
  hash: '000dc75a315c77a1f9c98fb6247d03dd18ac52632d7dc6a9920261d8109b37cf',
  nonce: 604,
}

/**
 * 校验整条链。
 *
 * 创世区块（第 0 块）为什么不能「重算哈希比对」？
 * 后端 Block.genesis 里的哈希 000dc75a… 是教程里写死的常量，并不是由
 * calculateHash(0, "0", 1508270000000, "Genesis Block", 604) 算出来的——
 * 按该公式重算会得到 9d538aa0…，两者必然不一致。
 * 因此后端自己的 isValidChain 对创世区块也只做「整块逐字段比对」
 * （JSON.stringify(chain[0]) === JSON.stringify(Block.genesis)），
 * 从第 1 个区块开始才做哈希重算 + 难度 + 前向链接校验。
 * 前端这里与后端保持完全相同的两段式规则，避免误报。
 *
 * 返回 { valid, results: [{ block, recomputed, checks, valid }] }
 */
export async function verifyChain(blocks, difficulty = 3) {
  const results = []
  let valid = true
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const recomputed = await recomputeBlockHash(block)
    const prev = blocks[i - 1]
    const isGenesis = i === 0
    const checks = isGenesis
      ? {
          // 创世区块：与后端 Block.genesis 整块一致（逐字段比对）
          genesisOk: JSON.stringify(block) === JSON.stringify(GENESIS_BLOCK),
          difficultyOk: isValidHashDifficulty(block.hash, difficulty),
        }
      : {
          hashOk: recomputed === block.hash,                       // 哈希与内容一致（未被篡改）
          difficultyOk: isValidHashDifficulty(block.hash, difficulty), // 满足工作量证明难度
          linkOk: !!prev && block.previousHash === prev.hash && block.index === prev.index + 1, // 前向链接
        }
    const blockValid = Object.values(checks).every(Boolean)
    valid = valid && blockValid
    results.push({ block, recomputed, checks, valid: blockValid })
  }
  return { valid, results }
}
