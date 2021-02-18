import {ethers} from 'ethers';
import axios from 'axios';
import { createArrayCsvWriter } from 'csv-writer';
import dotenv from 'dotenv'
dotenv.config()

const INV = "0x41D5D79431A913C4aE7d69a668ecdfE5fF9DFB68"

const EXCLUDE_FROM_REWARD = [
    '0xbb6ef0b93792e4e98c6e6062eb1a9638d82e500f'
]

const INCLUDE_IN_REWARD = [
    '0x3FcB35a1CbFB6007f9BC638D388958Bc4550cB28'
]

const EXCLUDE_FROM_SEIZE = [
    '0x926dF14a23BE491164dCF93f4c468A50ef659D5B'
]

async function exportCSV(filename, records) {
    const csvWriter = createArrayCsvWriter({
        header: ['ADDRESS'],
        path: filename
    });
    await csvWriter.writeRecords(records.map(v => [v]))
}

async function getProposalVoters(proposalId) {
    const res = await axios.get(`https://hub.snapshot.page/api/inversefinance.eth/proposal/${proposalId}`)
    const data = res.data
    return Object.keys(data);
}

async function getSnapshotVoters() {
    const proposals = [
        "QmPXFNwtrEtEwaF7VEqZhTx27yL6DhvUJHkw3VhPPLQfqu",
        "QmYJqfhA1u8xrWgZAm8wrxViUGnXdp2nJBmXSy2d5UWz1m"
    ]

    let allVoters = []
    for (let i = 0; i < proposals.length; i++) {
        const voters = await getProposalVoters(proposals[i]);
        allVoters = [...new Set([...allVoters, ...voters])]
    }

    return allVoters;

}

const provider = new ethers.providers.AlchemyProvider("homestead", process.env.ALCHEMY_KEY)

async function getVaultDepositors(address) {
    const vault = new ethers.Contract(address, [
        "event Transfer(address indexed from, address indexed to, uint256 amount)",
    ], provider);

    const transferFilter = vault.filters.Transfer();
    const transfers = await vault.queryFilter(transferFilter, 0, "latest");
    const deposits = transfers.filter(v => v.args.from === ethers.constants.AddressZero)
    const depositors = deposits.map(v => v.args.to);
    return [...new Set(depositors)]
}

async function getAllDepositors() {
    const vaults = [
        "0x89eC5dF87a5186A0F0fa8Cb84EdD815de6047357",
        "0xc8f2E91dC9d198edEd1b2778F6f2a7fd5bBeac34",
        "0x41D079ce7282d49bf4888C71B5D9E4A02c371F9B",
        "0x2dCdCA085af2E258654e47204e483127E0D8b277"
    ]

    let allDepositors = []
    for (let i = 0; i < vaults.length; i++) {
        const depositors = await getVaultDepositors(vaults[i]);
        allDepositors = [...new Set([...allDepositors, ...depositors])]
    }

    return allDepositors;

}

const token = new ethers.Contract(INV, [
    "event Transfer(address indexed from, address indexed to, uint256 amount)",
    "function balanceOf(address account) external view returns (uint)",
    "event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)"
], provider);

// get list of all holders
const transferFilter = token.filters.Transfer();
const transfers = await token.queryFilter(transferFilter, 11498340, "latest");
console.log('Transfers', transfers.length)

let holders = [... new Set(transfers.map(v => v.args.to))]
console.log('Initial Holders', holders.length)

let balances = []
for (let i = 0; i < holders.length; i++) {
    balances.push(await token.balanceOf(holders[i]))
    if((i+1) % 10 === 0) {
        console.log(i+1, '/', holders.length)
    }
}

console.log('Balances', balances.length)

holders = holders.filter((_, i) => balances[i].gt(0))
console.log('Filtered Holders', holders.length)

// get list of all delegators
const delegateFilter = token.filters.DelegateChanged();
const delegations = await token.queryFilter(delegateFilter, 11498340, "latest");
const delegators = [... new Set(delegations.map(v => v.args.delegator))]
console.log('Delegators', delegators.length)

// get list of all snapshot voters
const snapshotVoters = await getSnapshotVoters();
console.log('Snapshot voters', snapshotVoters.length)

// get list of depositors
const depositors = await getAllDepositors()
console.log('Depositors', depositors.length)


const seizeList = holders.filter(v => !delegators.includes(v) && !snapshotVoters.includes(v) && !depositors.includes(v) && !EXCLUDE_FROM_SEIZE.includes(v))
console.log('Free Riders', seizeList.length)

let actives = holders.filter(v => !seizeList.includes(v) && !EXCLUDE_FROM_REWARD.includes(v))
actives = [...new Set([...actives, INCLUDE_IN_REWARD])]
console.log('Active holders', actives.length)

await exportCSV('seize.csv', seizeList)
await exportCSV('reward.csv', actives)