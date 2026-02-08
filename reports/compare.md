# API Comparison Report (MVP)

Generated at: 2026-02-08T10:15:31.431Z

## ethers.js

- passed: 6
- failed: 0
- total duration: 232ms

| scenario | status | duration(ms) | output |
|---|---:|---:|---|
| chain-info | PASS | 12 | {"chainId":31337,"blockNumber":8} |
| account-state | PASS | 12 | {"address":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","balanceWei":"999998875340234316081","nonce":8} |
| contract-read | PASS | 18 | {"count":"1"} |
| tx-send-native | PASS | 92 | {"hash":"0x054b6d79204afeddf1b33e775b44efcb9a15b92d7efb507671efcb5abffda1a4","status":1,"blockNumber":9} |
| tx-write-contract | PASS | 85 | {"hash":"0xb8ad7dfb070c9eddbfb4758f5032a8b25f4a16940d3d5794a5746ccc3f21321a","status":1,"blockNumber":10} |
| tx-query-lifecycle | PASS | 13 | {"hash":"0xb8ad7dfb070c9eddbfb4758f5032a8b25f4a16940d3d5794a5746ccc3f21321a","hasTransaction":true,"hasReceipt":true,"status":1,"confirmations":0} |

## viem

- passed: 6
- failed: 0
- total duration: 77ms

| scenario | status | duration(ms) | output |
|---|---:|---:|---|
| chain-info | PASS | 33 | {"chainId":31337,"blockNumber":10} |
| account-state | PASS | 2 | {"address":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","balanceWei":"999998712974853389065","balanceEth":"999.998712974853389065","nonce":10} |
| contract-read | PASS | 4 | {"count":"2"} |
| tx-send-native | PASS | 20 | {"hash":"0x554a5de1a19a2cbc79330f9dc1f6d469916285ab7ef58ac9156fd15158771646","status":"success","blockNumber":11} |
| tx-write-contract | PASS | 16 | {"hash":"0x62e2cd5d1d5c3a277c326e7ea082eb8e6f7d0e5e72ea7ba15869f77b3eea4a9a","status":"success","blockNumber":12} |
| tx-query-lifecycle | PASS | 2 | {"hash":"0x62e2cd5d1d5c3a277c326e7ea082eb8e6f7d0e5e72ea7ba15869f77b3eea4a9a","status":"success","confirmations":0,"blockNumber":12,"to":"0xdc64a140aa3e981100a9beca4e685f962f0cf6c9"} |

## Speed Comparison

| scenario | ethers(ms) | viem(ms) | faster |
|---|---:|---:|---|
| chain-info | 12 | 33 | ethers |
| account-state | 12 | 2 | viem |
| contract-read | 18 | 4 | viem |
| tx-send-native | 92 | 20 | viem |
| tx-write-contract | 85 | 16 | viem |
| tx-query-lifecycle | 13 | 2 | viem |
