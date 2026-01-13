package com.societyilada.manager.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import com.societyilada.manager.MainActivity;
import com.societyilada.manager.R;

/**
 * Society Mitra Query Widget Provider
 * Provides quick access to AI assistant from home screen
 */
public class SocietyMitraQueryWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "SocietyMitraWidgetPrefs";
    private static final String PREF_LAST_QUERY = "last_query_";
    private static final String PREF_LAST_ANSWER = "last_answer_";
    private static final String ACTION_ASK_QUESTION = "com.societyilada.manager.ASK_QUESTION";
    private static final String ACTION_VIEW_RESPONSE = "com.societyilada.manager.VIEW_RESPONSE";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_society_mitra_query);

        // Load last query and answer from preferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String lastQuery = prefs.getString(PREF_LAST_QUERY + appWidgetId, "कर्ज बाकी किती आहे?");
        String lastAnswer = prefs.getString(PREF_LAST_ANSWER + appWidgetId, "एकूण कर्ज बाकी ₹45,000 आहे...");

        // Update text views
        views.setTextViewText(R.id.last_query_text, lastQuery);
        views.setTextViewText(R.id.last_answer_text, lastAnswer);

        // Set up "Ask Question" button intent
        Intent askIntent = new Intent(context, WidgetQueryActivity.class);
        askIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        askIntent.setAction(ACTION_ASK_QUESTION);
        PendingIntent askPendingIntent = PendingIntent.getActivity(
            context, 
            appWidgetId, 
            askIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.ask_question_button, askPendingIntent);

        // Set up tap on response to open full app
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.putExtra("openAI", true);
        openAppIntent.putExtra("query", lastQuery);
        openAppIntent.setAction(ACTION_VIEW_RESPONSE);
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
            context, 
            appWidgetId + 1000, 
            openAppIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.last_query_section, openAppPendingIntent);

        // Update widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        // Clean up preferences when widget is deleted
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        for (int appWidgetId : appWidgetIds) {
            editor.remove(PREF_LAST_QUERY + appWidgetId);
            editor.remove(PREF_LAST_ANSWER + appWidgetId);
        }
        editor.apply();
    }

    /**
     * Update widget with new query and answer
     */
    public static void updateWidgetData(Context context, int appWidgetId, String query, String answer) {
        // Save to preferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(PREF_LAST_QUERY + appWidgetId, query);
        editor.putString(PREF_LAST_ANSWER + appWidgetId, answer);
        editor.apply();

        // Update widget display
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        updateAppWidget(context, appWidgetManager, appWidgetId);
    }
}
