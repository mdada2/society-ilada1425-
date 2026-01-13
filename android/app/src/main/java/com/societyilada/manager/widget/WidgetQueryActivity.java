package com.societyilada.manager.widget;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import com.societyilada.manager.R;

/**
 * Activity to handle widget query input
 * Shows dialog for user to type their question
 */
public class WidgetQueryActivity extends Activity {

    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Get widget ID from intent
        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            );
        }

        // If invalid widget ID, finish
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        // Show input dialog
        showQueryDialog();
    }

    private void showQueryDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Society Mitra AI");
        builder.setMessage("तुमचा प्रश्न विचारा:");

        // Create input field
        final EditText input = new EditText(this);
        input.setHint("उदा. कर्ज बाकी किती आहे?");
        input.setPadding(50, 30, 50, 30);
        builder.setView(input);

        // Set up buttons
        builder.setPositiveButton("विचारा", (dialog, which) -> {
            String query = input.getText().toString().trim();
            if (!query.isEmpty()) {
                processQuery(query);
            } else {
                Toast.makeText(this, "कृपया प्रश्न टाइप करा", Toast.LENGTH_SHORT).show();
                finish();
            }
        });

        builder.setNegativeButton("रद्द करा", (dialog, which) -> {
            dialog.cancel();
            finish();
        });

        builder.setOnCancelListener(dialog -> finish());

        builder.show();
    }

    private void processQuery(String query) {
        // For now, show a placeholder response
        // In production, this would call the AI service
        String answer = "तुमचा प्रश्न प्रक्रियेत आहे... कृपया app उघडा पूर्ण उत्तरासाठी.";

        // Update widget with query and answer
        SocietyMitraQueryWidgetProvider.updateWidgetData(
            this,
            appWidgetId,
            query,
            answer
        );

        // Show confirmation
        Toast.makeText(this, "प्रश्न पाठवला!", Toast.LENGTH_SHORT).show();

        // Open main app with AI chat
        Intent openAppIntent = new Intent(this, com.societyilada.manager.MainActivity.class);
        openAppIntent.putExtra("openAI", true);
        openAppIntent.putExtra("query", query);
        openAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(openAppIntent);

        finish();
    }
}
