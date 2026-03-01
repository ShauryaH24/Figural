package com.figural.app

import android.app.Application
import com.meta.wearable.dat.core.Wearables

class FiguralApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Wearables.configure(this)
    }
}
