import { cacheExchange } from 'urql'

import { SharedService, exposeSharedService } from '@repliql/shared-exchange'

const service = new SharedService({ exchange: cacheExchange })
exposeSharedService(service)
