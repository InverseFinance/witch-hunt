# Inverse DAO Witch Hunt

## Overview
Script that generates list of inactive holders to seize

Inactive is defined as an INV token holder who has never done any of the following:
- Delegated their vote to someone else or to themselves
- Voted on at least one Snapshot vote
- Deposited into at least one Inverse vault

## Usage

Requires Node.js v14.8.0 or higher

Copy `.env.example` to `.env` and add your Alchemy API key to it

Run:
```
npm i
node index.js
```

2 files will be created `seize.csv` and `reward.csv`