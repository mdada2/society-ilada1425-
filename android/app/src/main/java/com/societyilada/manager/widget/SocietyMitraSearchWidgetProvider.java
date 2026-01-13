package com.societyilada.manager.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import com.societyilada.manager.MainActivity;
import com.societyilada.manager.R;

/**
 * Society Mitra Search Widget Provider
 * Quick member search from home screen
 */
public class SocietyMitraSearchWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_society_mitra_search);

        // Set up click to open search in app
        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("openSearch", true);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 
            appWidgetId, 
            intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.search_icon, pendingIntent);

        // Update widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
